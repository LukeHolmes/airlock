#!/bin/bash
# ==============================================================================
# Airlock Process Cleanup Listener
# ==============================================================================
# Supervisor event listener that handles process exits and performs
# cleanup when the target application terminates.
# ==============================================================================

set -euo pipefail

log() {
    printf '[cleanup] %s\n' "$*" >&2
}

# Read event header from supervisor
read_event() {
    local header
    read -r header
    echo "$header"
}

# Handle process exit
handle_exit() {
    local process_name=$1
    local exit_code=$2
    
    log "Process $process_name exited with code $exit_code"
    
    # If the target launcher exited, signal supervisor to shut down
    if [[ "$process_name" == "target-launcher" ]]; then
        log "Target application closed, initiating shutdown..."
        # Trigger graceful shutdown
        kill -TERM "$(cat /tmp/supervisord.pid)" 2>/dev/null || true
    fi
}

# Main event loop
main() {
    log "Cleanup listener started"
    
    # Write ready notification to supervisor
    echo "READY"
    
    while true; do
        # Read event header
        local event
        event=$(read_event)
        
        # Parse event (format: ver:3.0 server:supervisor serial:... event:...)
        local event_type
        event_type=$(echo "$event" | grep -oP 'event:\K[^ ]+' || echo "unknown")
        
        # Read payload length
        local len_header
        read -r len_header
        local payload_len
        payload_len=$(echo "$len_header" | grep -oP 'len:\K[0-9]+' || echo "0")
        
        # Read payload if present
        local payload=""
        if [[ "$payload_len" -gt 0 ]]; then
            payload=$(head -c "$payload_len")
        fi
        
        # Process event
        case "$event_type" in
            PROCESS_STATE_EXITED|PROCESS_STATE_STOPPED|PROCESS_STATE_FATAL)
                # Extract process name from payload
                local process_name
                process_name=$(echo "$payload" | grep -oP 'processname:\K[^,]+' || echo "unknown")
                local exit_code
                exit_code=$(echo "$payload" | grep -oP 'expected:\K[0-9]+' || echo "0")
                handle_exit "$process_name" "$exit_code"
                ;;
        esac
        
        # Write result notification
        echo "RESULT 2"
        echo "OK"
    done
}

main "$@"
