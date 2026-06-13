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

# Extract key:value from supervisor event lines (BusyBox-safe, no PCRE)
extract_field() {
    local line=$1
    local key=$2
    local value

    value=$(printf '%s' "$line" | sed -n "s/.*${key}:\([^ ]*\).*/\1/p" | head -n 1)
    if [[ -n "$value" ]]; then
        printf '%s' "$value"
    fi
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

    if [[ "$process_name" == "target-launcher" ]]; then
        log "Target application closed, initiating shutdown..."
        kill -TERM "$(cat /tmp/supervisord.pid)" 2>/dev/null || true
    fi
}

# Main event loop
main() {
    log "Cleanup listener started"

    echo "READY"

    while true; do
        local event
        event=$(read_event)

        local event_type
        event_type=$(extract_field "$event" "event")
        [[ -z "$event_type" ]] && event_type="unknown"

        local len_header
        read -r len_header
        local payload_len
        payload_len=$(extract_field "$len_header" "len")
        [[ -z "$payload_len" ]] && payload_len="0"

        local payload=""
        if [[ "$payload_len" -gt 0 ]]; then
            payload=$(head -c "$payload_len")
        fi

        case "$event_type" in
            PROCESS_STATE_EXITED|PROCESS_STATE_STOPPED|PROCESS_STATE_FATAL)
                local process_name
                process_name=$(extract_field "$payload" "processname")
                [[ -z "$process_name" ]] && process_name="unknown"
                local exit_code
                exit_code=$(extract_field "$payload" "expected")
                [[ -z "$exit_code" ]] && exit_code="0"
                handle_exit "$process_name" "$exit_code"
                ;;
        esac

        echo "RESULT 2"
        echo "OK"
    done
}

main "$@"
