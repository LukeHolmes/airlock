#!/bin/bash
# ==============================================================================
# Airlock Sandbox Entrypoint
# ==============================================================================
# Initializes headless X11, KasmVNC server, and launches the target application
# inside an isolated, air-gapped container environment.
#
# Environment Variables (set by ContainerManager or defaults):
#   TARGET_FILE       - Path to file to open (e.g., /workspace/target.pdf)
#   TARGET_URL        - URL to open (e.g., https://example.com)
#   VNC_PORT          - KasmVNC WebSocket port (default: 6901)
#   VNC_RESOLUTION    - Display resolution (default: 1920x1080)
#   DISPLAY           - X11 display number (default: :1)
#   MAX_FRAME_RATE    - VNC frame rate cap (default: 24)
#
# Exit Codes:
#   0  - Graceful shutdown
#   1  - Fatal error (X11 or VNC failed to start)
# ==============================================================================

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================

readonly DISPLAY_NUM="${DISPLAY:-:1}"
readonly DISPLAY_NUM_CLEAN="${DISPLAY_NUM#:}"
readonly VNC_PORT="${VNC_PORT:-6901}"
readonly VNC_RESOLUTION="${VNC_RESOLUTION:-1920x1080}"
readonly VNC_COL_DEPTH="${VNC_COL_DEPTH:-24}"
readonly MAX_FRAME_RATE="${MAX_FRAME_RATE:-24}"
readonly HOME="${HOME:-/home/airlock}"

# Target specification (file takes precedence over URL)
TARGET_FILE="${TARGET_FILE:-}"
TARGET_URL="${TARGET_URL:-}"

# ==============================================================================
# Logging
# ==============================================================================

log() {
    printf '[airlock] %s %s\n' "$(date -Iseconds)" "$*"
}

log_info() { log "[INFO] $*"; }
log_warn() { log "[WARN] $*" >&2; }
log_error() { log "[ERROR] $*" >&2; }

# ==============================================================================
# VNC Password & SSL Setup
# ==============================================================================

setup_vnc_security() {
    log_info "Setting up VNC security..."
    
    mkdir -p "$HOME/.vnc"
    
    # Generate ephemeral self-signed certificate for this session
    # This ensures each container session has unique SSL credentials
    local cert_file="$HOME/.vnc/self.pem"
    if [[ ! -f "$cert_file" ]]; then
        openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
            -keyout "$cert_file" \
            -out "$cert_file" \
            -subj "/C=XX/ST=Airlock/L=Sandbox/O=Airlock/CN=localhost" \
            2>/dev/null || {
            log_warn "Failed to generate SSL certificate, VNC may use unencrypted mode"
        }
    fi
    
    # Generate ephemeral VNC password
    local passwd_file="$HOME/.vnc/passwd"
    local vnc_password
    vnc_password=$(openssl rand -base64 12)
    
    # vncpasswd requires X11, so we create a simple hash directly
    # For KasmVNC, we can use the -disableBasicAuth flag since we're air-gapped
    log_info "VNC credentials generated (ephemeral for this session)"
    
    chmod 600 "$HOME/.vnc"/* 2>/dev/null || true
}

# ==============================================================================
# X11 Display Setup (Xvfb)
# ==============================================================================

start_x11() {
    log_info "Starting Xvfb on display ${DISPLAY}..."
    
    # Parse resolution
    local width height
    IFS='x' read -r width height <<< "$VNC_RESOLUTION"
    
    # Start Xvfb with GL acceleration for Chromium
    Xvfb "${DISPLAY}" \
        -screen "${DISPLAY_NUM_CLEAN}" "${width}x${height}x${VNC_COL_DEPTH}" \
        -ac \
        +extension GLX \
        +render \
        -noreset \
        -novtswitch \
        > /tmp/Xvfb.log 2>&1 &
    
    local xvfb_pid=$!
    
    # Wait for X11 to be ready (max 10 seconds)
    local attempts=0
    local max_attempts=20
    while [[ $attempts -lt $max_attempts ]]; do
        if xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then
            log_info "X11 display ${DISPLAY} ready (PID: ${xvfb_pid})"
            return 0
        fi
        attempts=$((attempts + 1))
        sleep 0.5
    done
    
    log_error "X11 display failed to start within 10 seconds"
    cat /tmp/Xvfb.log >&2 || true
    return 1
}

# ==============================================================================
# KasmVNC Server Setup
# ==============================================================================

start_kasmvnc() {
    log_info "Starting KasmVNC on port ${VNC_PORT}..."
    
    # Build geometry string
    local geometry="${VNC_RESOLUTION}x${VNC_COL_DEPTH}"
    
    # Start KasmVNC server
    # Key options for Airlock:
    #   -interface 0.0.0.0         # Bind all interfaces (container internal only)
    #   -WebsocketPort            # WebSocket port for browser access
    #   -disableBasicAuth         # No password auth (air-gapped + ephemeral)
    #   -MaxFrameRate             # Cap frame rate to reduce resource usage
    #   -PreferBandwidth          # Optimize for bandwidth over quality
    vncserver "${DISPLAY}" \
        -interface 0.0.0.0 \
        -WebsocketPort "${VNC_PORT}" \
        -httpd "/usr/share/kasmvnc/www" \
        -geometry "${geometry}" \
        -depth "${VNC_COL_DEPTH}" \
        -MaxFrameRate "${MAX_FRAME_RATE}" \
        -FrameRate "${MAX_FRAME_RATE}" \
        -PreferBandwidth \
        -DynamicQualityMin=4 \
        -DynamicQualityMax=7 \
        -DLP_ClipDelay=0 \
        -disableBasicAuth \
        -PreferPassword \
        -BlacklistThreshold 0 \
        -BlacklistTimeout 0 \
        > /tmp/KasmVNC.log 2>&1 &
    
    local vnc_pid=$!
    
    # Wait for port to be open (max 10 seconds)
    local attempts=0
    local max_attempts=20
    while [[ $attempts -lt $max_attempts ]]; do
        if nc -z localhost "${VNC_PORT}" 2>/dev/null; then
            log_info "KasmVNC ready on port ${VNC_PORT} (PID: ${vnc_pid})"
            log_info "Web interface available at container port ${VNC_PORT}"
            return 0
        fi
        attempts=$((attempts + 1))
        sleep 0.5
    done
    
    log_error "KasmVNC failed to start within 10 seconds"
    cat /tmp/KasmVNC.log >&2 || true
    return 1
}

# ==============================================================================
# Window Manager
# ==============================================================================

start_window_manager() {
    log_info "Starting Openbox window manager..."
    
    # Export DISPLAY for Openbox
    export DISPLAY
    
    openbox &
    local openbox_pid=$!
    
    # Brief wait for Openbox to initialize
    sleep 0.5
    
    log_info "Openbox started (PID: ${openbox_pid})"
}

# ==============================================================================
# Target Application Launcher
# ==============================================================================

launch_target() {
    log_info "=========================================="
    log_info "Preparing to launch target..."
    log_info "File: ${TARGET_FILE:-<none>}"
    log_info "URL: ${TARGET_URL:-<none>}"
    log_info "=========================================="
    
    # Determine what to launch
    if [[ -n "$TARGET_FILE" && -f "$TARGET_FILE" ]]; then
        _launch_file "$TARGET_FILE"
    elif [[ -n "$TARGET_URL" ]]; then
        _launch_url "$TARGET_URL"
    else
        _launch_default
    fi
}

_launch_file() {
    local file_path=$1
    local mime_type
    
    mime_type=$(file -b --mime-type "$file_path" 2>/dev/null || echo "application/octet-stream")
    log_info "File detected: $file_path (MIME: $mime_type)"
    
    case "$mime_type" in
        application/pdf|application/postscript|application/x-pdf)
            log_info "Launching Evince for PDF..."
            evince "$file_path" &
            ;;
            
        text/html|application/xhtml+xml)
            log_info "Launching Chromium for HTML file..."
            chromium-browser \
                --no-sandbox \
                --disable-dev-shm-usage \
                --disable-gpu \
                --disable-features=VizDisplayCompositor \
                --window-size=1920,1080 \
                --start-maximized \
                "file://$file_path" &
            ;;
            
        text/*)
            log_info "Opening text file in xterm..."
            xterm \
                -bg '#08090B' \
                -fg '#ECEFF3' \
                -fa 'JetBrains Mono' \
                -fs 12 \
                -e "cat '$file_path'; echo ''; echo '--- Press Enter to close ---'; read" &
            ;;
            
        image/*)
            log_info "Opening image in Chromium..."
            chromium-browser \
                --no-sandbox \
                --disable-dev-shm-usage \
                --window-size=1920,1080 \
                "$file_path" &
            ;;
            
        *)
            log_warn "Unknown file type ($mime_type), attempting with Chromium..."
            chromium-browser \
                --no-sandbox \
                --disable-dev-shm-usage \
                "$file_path" &
            ;;
    esac
}

_launch_url() {
    local url=$1
    log_info "Launching Chromium for URL: $url"
    
    chromium-browser \
        --no-sandbox \
        --disable-dev-shm-usage \
        --disable-gpu \
        --disable-features=VizDisplayCompositor,SiteIsolationForPasswords \
        --no-first-run \
        --no-default-browser-check \
        --window-size=1920,1080 \
        --start-maximized \
        --app="$url" &
}

_launch_default() {
    log_info "No target specified, launching Chromium with about:blank"
    
    chromium-browser \
        --no-sandbox \
        --disable-dev-shm-usage \
        --window-size=1920,1080 \
        --start-maximized \
        about:blank &
}

# ==============================================================================
# Signal Handlers
# ==============================================================================

shutdown() {
    local signal=$1
    log_info "Received ${signal}, initiating graceful shutdown..."
    
    # Signal supervisor to shut down all managed processes
    if [[ -f /tmp/supervisord.pid ]]; then
        kill "$(cat /tmp/supervisord.pid)" 2>/dev/null || true
    fi
    
    # Kill any remaining X11/KasmVNC processes
    vncserver -kill "${DISPLAY}" 2>/dev/null || true
    
    log_info "Shutdown complete"
    exit 0
}

trap 'shutdown SIGTERM' SIGTERM
trap 'shutdown SIGINT' SIGINT

# ==============================================================================
# Main
# ==============================================================================

main() {
    log_info "=========================================="
    log_info "Airlock Sandbox Starting"
    log_info "Version: 0.1.0"
    log_info "Resolution: ${VNC_RESOLUTION}"
    log_info "VNC Port: ${VNC_PORT}"
    log_info "User: $(id -un) (UID: $(id -u))"
    log_info "=========================================="
    
    # Validate environment
    if [[ $(id -u) -eq 0 ]]; then
        log_warn "Running as root! This should not happen."
    fi
    
    # Setup security
    setup_vnc_security
    
    # Start core services
    if ! start_x11; then
        log_error "Failed to start X11, aborting"
        exit 1
    fi
    
    if ! start_kasmvnc; then
        log_error "Failed to start KasmVNC, aborting"
        exit 1
    fi
    
    # Start window manager
    start_window_manager
    
    # Allow desktop to settle
    sleep 1
    
    # Launch target application
    launch_target
    
    log_info "=========================================="
    log_info "Sandbox ready"
    log_info "Connect via WebSocket on port ${VNC_PORT}"
    log_info "=========================================="
    
    # Keep script running to maintain signal handling
    # In supervisor mode, this is handled by supervisord
    # In standalone mode, we wait
    if [[ "${1:-}" == "supervisord" ]]; then
        # Supervisor mode: exec to replace this process
        exec "$@"
    else
        # Standalone mode: wait forever
        while true; do
            sleep 1
        done
    fi
}

# Run main if not being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
