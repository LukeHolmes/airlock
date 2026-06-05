#!/bin/bash
# ==============================================================================
# Airlock Target Application Launcher
# ==============================================================================
# Determines the appropriate application to launch based on TARGET_FILE
# or TARGET_URL environment variables, then starts the app with proper
# X11 context.
# ==============================================================================

set -euo pipefail

TARGET_FILE="${TARGET_FILE:-}"
TARGET_URL="${TARGET_URL:-}"
DISPLAY="${DISPLAY:-:1}"

log() {
    printf '[launcher] %s\n' "$*"
}

# Wait for X11 to be ready
wait_for_x11() {
    local attempts=0
    while [[ $attempts -lt 30 ]]; do
        if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
            return 0
        fi
        attempts=$((attempts + 1))
        sleep 0.5
    done
    log "ERROR: X11 not available after 15 seconds"
    return 1
}

# Launch file based on MIME type
launch_file() {
    local file_path=$1
    local mime_type
    
    mime_type=$(file -b --mime-type "$file_path" 2>/dev/null || echo "unknown")
    log "Launching file: $file_path (MIME: $mime_type)"
    
    case "$mime_type" in
        application/pdf|application/postscript|application/x-pdf)
            exec evince "$file_path"
            ;;
        text/html|application/xhtml+xml)
            exec chromium-browser \
                --no-sandbox \
                --disable-dev-shm-usage \
                --disable-gpu \
                --window-size=1920,1080 \
                --start-maximized \
                "file://$file_path"
            ;;
        text/*)
            # Simple text display
            exec xterm \
                -bg '#08090B' \
                -fg '#ECEFF3' \
                -fs 12 \
                -maximized \
                -e "cat '$file_path'; echo ''; read -p 'Press Enter to close...'"
            ;;
        image/*)
            exec chromium-browser \
                --no-sandbox \
                --window-size=1920,1080 \
                "$file_path"
            ;;
        *)
            log "Unknown MIME type ($mime_type), trying Chromium"
            exec chromium-browser \
                --no-sandbox \
                --disable-dev-shm-usage \
                "$file_path"
            ;;
    esac
}

# Launch URL in browser
launch_url() {
    local url=$1
    log "Launching URL: $url"
    
    exec chromium-browser \
        --no-sandbox \
        --disable-dev-shm-usage \
        --disable-gpu \
        --no-first-run \
        --no-default-browser-check \
        --window-size=1920,1080 \
        --start-maximized \
        "$url"
}

# Launch default (blank browser)
launch_default() {
    log "No target specified, launching blank browser"
    
    exec chromium-browser \
        --no-sandbox \
        --disable-dev-shm-usage \
        --window-size=1920,1080 \
        --start-maximized \
        about:blank
}

# Main
main() {
    log "Starting target launcher..."
    
    # Wait for X11
    if ! wait_for_x11; then
        log "X11 unavailable, cannot launch application"
        exit 1
    fi
    
    # Export DISPLAY for child processes
    export DISPLAY
    
    # Launch appropriate target
    if [[ -n "$TARGET_FILE" && -f "$TARGET_FILE" ]]; then
        launch_file "$TARGET_FILE"
    elif [[ -n "$TARGET_URL" ]]; then
        launch_url "$TARGET_URL"
    else
        launch_default
    fi
}

main "$@"
