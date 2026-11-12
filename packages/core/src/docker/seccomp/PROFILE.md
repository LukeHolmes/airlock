# Airlock seccomp profile

## Upstream

- **Moby** `profiles/seccomp/default.json` at tag **v27.4.0**
  (https://github.com/moby/moby/blob/v27.4.0/profiles/seccomp/default.json, Apache-2.0).
- Vendored copy: `moby-default.v27.4.0.json` (reference only).

## Reconciled profile

`airlock.profile.json` is the effective Docker seccomp JSON for Airlock sandboxes.

Compared to Moby v27.4.0 default:

### Additional explicit denials (prepended rule, `EPERM`)

Syscalls Moby allows in its baseline allow-list but Airlock rejects up front:

- `cachestat`, `futex_requeue`, `futex_wait`, `futex_waitv`, `futex_wake`
- `io_pgetevents`, `io_pgetevents_time64`
- `kexec_file_load`, `kexec_load`
- `map_shadow_stack`, `migrate_pages`, `move_pages`
- `nfsservctl`, `nice`, legacy `*stat`/`*uname` compat calls
- `pciconfig_*`, `sgetmask`, `ssetmask`, `swapoff`, `swapon`, `syscall`, `sysfs`
- `uselib`, `userfaultfd`, `ustat`, `vm86`, `vm86old`, `vmsplice`, `bdflush`

These are not required for viewer/triage workloads and reduce kernel attack surface.

### Supplemental allows (vs Moby flat allow rule)

Retained from the prior Airlock profile so container behaviour is unchanged:

- `keyctl` — libsecret / Chromium keyring-style IPC in the guest (non-privileged keys).
- `pivot_root` — not used at runtime with read-only rootfs; kept for parity with prior profile.
- `ptrace` — guest debugging/tooling compatibility inside the isolated session.
- `signal` — legacy libc signal syscall used by some Alpine userspace.
- `timerfd_settime_time64` — 32-bit time64 compat path for timerfd (supervisor/VNC stack).

Capability-gated rules from Moby remain; with **CapDrop ALL** those syscalls still return `EPERM`.

### Sandbox workloads covered

Alpine packages in `packages/sandbox/Dockerfile`: KasmVNC/Xvfb/supervisord, Openbox,
Chromium, Evince/poppler, LibreOffice, ExifTool, YARA, oletools, zbar, ImageMagick,
`img2pdf`, triage scripts, `airlock-flatten-pdf`.
