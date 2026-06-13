# ==============================================================================
# Airlock Sandbox — KasmVNC + Alpine Linux
# ==============================================================================
# A minimal, security-hardened container for running desktop applications
# in an isolated, air-gapped environment. Streams via KasmVNC WebSocket.
#
# Architecture:
#   - Alpine 3.21 (minimal base)
#   - KasmVNC 1.4.1 (WebRTC/WebSocket VNC server)
#   - Xvfb (headless X11 display)
#   - Openbox (minimal window manager)
#   - Chromium, Evince (sandboxed applications)
#
# Security (enforced by ContainerManager at runtime):
#   - NetworkMode: 'none' (air-gapped)
#   - CapDrop: ['ALL'] (no capabilities)
#   - SecurityOpt: ['no-new-privileges', 'seccomp=<profile>']
#   - Read-only input mounts
#   - Non-root user (1000:1000)
#
# References:
#   - Notion: Airlock Project Reference
#   - KasmTech: https://github.com/kasmtech/workspaces-core-images
#   - LinuxServer: https://github.com/linuxserver/docker-baseimage-kasmvnc
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base Alpine with core dependencies
# ------------------------------------------------------------------------------
FROM alpine:3.21 AS base

# Security: Create non-root user early, no sudo
RUN addgroup -g 1000 airlock && \
    adduser -u 1000 -G airlock -s /bin/sh -D airlock

# Install runtime dependencies
# Grouped by function for maintainability
RUN apk add --no-cache \
    # X11 virtual framebuffer
    xvfb \
    # Fonts (comprehensive coverage)
    font-noto \
    font-noto-cjk \
    font-noto-emoji \
    ttf-liberation \
    ttf-freefont \
    # Input/keyboard handling
    libinput \
    xf86-input-libinput \
    xkeyboard-config \
    xkbcomp \
    setxkbmap \
    # SSL for KasmVNC
    openssl \
    # Process management
    supervisor \
    # Utilities
    bash \
    coreutils \
    procps \
    net-tools \
    curl \
    ca-certificates \
    file \
    xdg-utils \
    shared-mime-info \
    xdpyinfo

# ------------------------------------------------------------------------------
# Stage 2: KasmVNC Server
# ------------------------------------------------------------------------------
FROM base AS kasmvnc

ARG TARGETARCH

# KasmVNC version configuration
ENV KASMVNC_VER="1.4.1"
ENV KASMVNC_COMMIT="0a64d3381cf2ebfb53685c9c9c804e8a327bf0a3"
ENV KASMVNC_COMMIT_SHORT="0a64d3"
ENV KASM_VNC_PATH=/usr/share/kasmvnc

# Install KasmVNC Alpine package
RUN set -eux; \
    # Determine architecture
    if [ "$TARGETARCH" = "amd64" ] || [ -z "$TARGETARCH" ]; then \
        BUILD_ARCH="x86_64"; \
    else \
        BUILD_ARCH="aarch64"; \
    fi; \
    \
    # Download URL format: kasmvncserver_alpine_{VERSION}_{ARCH}.apk
    BUILD_URL="https://kasmweb-build-artifacts.s3.amazonaws.com/kasmvnc/${KASMVNC_COMMIT}/kasmvncserver_alpine_321_${KASMVNC_VER}_master_${KASMVNC_COMMIT_SHORT}_${BUILD_ARCH}.apk"; \
    \
    echo "Downloading KasmVNC for ${BUILD_ARCH}..."; \
    wget -q "${BUILD_URL}" -O /tmp/kasmvncserver.apk; \
    \
    # KasmVNC dependencies for Alpine
    apk add --no-cache \
        libgomp \
        libjpeg-turbo \
        libwebp \
        libxfont2 \
        libxshmfence \
        mesa-gbm \
        pciutils-libs \
        pixman \
        xauth \
        xterm \
        perl \
        perl-datetime \
        perl-hash-merge-simple \
        perl-list-moreutils \
        perl-switch \
        perl-try-tiny \
        perl-yaml-tiny \
        perl-datetime-timezone \
        py3-xdg; \
    \
    # Install KasmVNC (allow-untrusted required for self-signed package)
    apk add --no-cache --allow-untrusted /tmp/kasmvncserver.apk; \
    rm -f /tmp/kasmvncserver.apk; \
    \
    # Create compatibility symlinks
    ln -sf /usr/local/share/kasmvnc /usr/share/kasmvnc || true; \
    ln -sf /usr/local/etc/kasmvnc /etc/kasmvnc || true; \
    \
    # Setup VNC directories
    mkdir -p /usr/share/kasmvnc/www/Downloads; \
    chown -R 1000:0 /usr/share/kasmvnc/www/Downloads

# KasmVNC configuration (minimal, allows env overrides)
COPY <<'EOF' /etc/kasmvnc/kasmvnc.yaml
network:
 ssl:
   pem_certificate: ${HOME}/.vnc/self.pem
   pem_key: ${HOME}/.vnc/self.pem
 udp:
   public_ip: 127.0.0.1
runtime_configuration:
 allow_override_standard_vnc_server_settings: true
 allow_override_list:
   - pointer.enabled
server:
 allow_environment_variables_to_override_config_settings: true
EOF

RUN chown airlock:airlock /etc/kasmvnc/kasmvnc.yaml

# ------------------------------------------------------------------------------
# Stage 3: Desktop Environment (Openbox)
# ------------------------------------------------------------------------------
FROM kasmvnc AS desktop

RUN apk add --no-cache \
    openbox \
    gtk+3.0 \
    adwaita-icon-theme \
    hicolor-icon-theme \
    libnotify

# Openbox configuration
COPY <<'EOF' /etc/xdg/openbox/menu.xml
<?xml version="1.0" encoding="UTF-8"?>
<openbox_menu xmlns="http://openbox.org/3.4/menu">
  <menu id="root-menu" label="Openbox 3">
    <item label="Chromium">
      <action name="Execute"><execute>chromium-browser</execute></action>
    </item>
    <item label="Evince">
      <action name="Execute"><execute>evince</execute></action>
    </item>
    <item label="File Manager">
      <action name="Execute"><execute>pcmanfm</execute></action>
    </item>
    <item label="Terminal">
      <action name="Execute"><execute>xterm</execute></action>
    </item>
    <separator />
    <item label="Reconfigure">
      <action name="Reconfigure" />
    </item>
    <item label="Exit">
      <action name="Exit" />
    </item>
  </menu>
</openbox_menu>
EOF

COPY <<'EOF' /etc/xdg/openbox/rc.xml
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <resistance>
    <strength>20</strength>
    <screen_edge_strength>20</screen_edge_strength>
  </resistance>
  <focus>
    <focusNew>yes</focusNew>
    <followMouse>no</followMouse>
    <focusLast>yes</focusLast>
    <underMouse>no</underMouse>
  </focus>
  <placement>
    <policy>Smart</policy>
    <center>yes</center>
  </placement>
  <theme>
    <name>Clearlooks</name>
  </theme>
  <desktops>
    <number>1</number>
    <firstdesk>1</firstdesk>
  </desktops>
  <keyboard>
    <keybind key="A-F4">
      <action name="Close"/>
    </keybind>
    <keybind key="A-Escape">
      <action name="Lower"/>
      <action name="FocusDesktop"/>
    </keybind>
  </keyboard>
  <mouse>
    <dragThreshold>8</dragThreshold>
  </mouse>
</openbox_config>
EOF

# ------------------------------------------------------------------------------
# Stage 4: Applications (Chromium, Evince)
# ------------------------------------------------------------------------------
FROM desktop AS apps

# Chromium (Alpine package name is chromium)
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    harfbuzz

# Chromium managed policies (disable features not needed in sandbox)
RUN mkdir -p /etc/chromium/policies/managed
COPY <<'EOF' /etc/chromium/policies/managed/airlock.json
{
  "HomepageLocation": "about:blank",
  "ShowHomeButton": false,
  "DefaultBrowserSettingEnabled": false,
  "PasswordManagerEnabled": false,
  "SafeBrowsingEnabled": false,
  "SyncDisabled": true,
  "SpellcheckEnabled": false,
  "DefaultGeolocationSetting": 2,
  "DefaultNotificationsSetting": 2,
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false,
  "BackgroundModeEnabled": false,
  "ComponentUpdatesEnabled": false,
  "PrintingEnabled": false,
  "CloudPrintProxyEnabled": false,
  "PromotionalTabsEnabled": false,
  "SearchSuggestEnabled": false,
  "UrlKeyedAnonymizedDataCollectionEnabled": false,
  "AutofillEnabled": false,
  "BrowserGuestModeEnabled": false,
  "BrowserAddPersonEnabled": false,
  "DeveloperToolsAvailability": 1,
  "IncognitoModeAvailability": 1,
  "SavingBrowserHistoryDisabled": true
}
EOF

# Document viewer (Evince) and dependencies
RUN apk add --no-cache \
    evince \
    poppler-utils

# ------------------------------------------------------------------------------
# Stage 5: Final Assembly
# ------------------------------------------------------------------------------
FROM apps AS final

# Create runtime directories
RUN mkdir -p \
    /home/airlock/.vnc \
    /home/airlock/.config/openbox \
    /home/airlock/workspace \
    /home/airlock/workspace/input \
    /home/airlock/Downloads \
    /tmp/.X11-unix \
    /var/log/supervisor \
    /etc/supervisor/conf.d && \
    chown -R airlock:airlock /home/airlock && \
    chmod 1777 /tmp/.X11-unix

# Copy entrypoint and helper scripts
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY launch-target.sh /usr/local/bin/launch-target.sh
COPY start-kasmvnc.sh /usr/local/bin/start-kasmvnc.sh
COPY cleanup.sh /usr/local/bin/cleanup.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/launch-target.sh /usr/local/bin/start-kasmvnc.sh /usr/local/bin/cleanup.sh

# Alpine chromium package installs /usr/bin/chromium; scripts expect chromium-browser
RUN if [ ! -e /usr/bin/chromium-browser ]; then ln -s /usr/bin/chromium /usr/bin/chromium-browser; fi

# Final ownership
RUN chown -R airlock:airlock \
    /home/airlock \
    /etc/xdg/openbox \
    /etc/chromium/policies

# Switch to non-root user
USER airlock
WORKDIR /home/airlock

# Expose KasmVNC WebSocket port
EXPOSE 6901

# Runtime environment defaults (overridable)
ENV DISPLAY=:1
ENV VNC_PORT=6901
ENV VNC_RESOLUTION=1920x1080
ENV VNC_COL_DEPTH=24
ENV HOME=/home/airlock
ENV USER=airlock
ENV MAX_FRAME_RATE=24
ENV VNCOPTIONS="-PreferBandwidth -DynamicQualityMin=4 -DynamicQualityMax=7"
ENV TARGET_FILE=""
ENV TARGET_URL=""

# Healthcheck (check if VNC is responding)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD nc -z localhost 6901 || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
