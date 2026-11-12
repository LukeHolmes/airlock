# Airlock seccomp profile

## Provenance

**Moby default, tightened for Airlock.**

- Upstream: [moby/moby `profiles/seccomp/default.json` @ v27.4.0](https://github.com/moby/moby/blob/v27.4.0/profiles/seccomp/default.json) (Apache-2.0).
- Reference copy: `moby-default.v27.4.0.json` (unchanged).
- Effective profile: `airlock.profile.json` = Moby rule order + Airlock tightenings below.

No supplemental syscall **ALLOW** rules beyond Moby (in particular no `keyctl`, `pivot_root`, `query_module`, `signal`, or legacy-only allows). With **CapDrop ALL**, capability-gated allows in Moby still resolve to **EPERM** via explicit deny rules where Moby would otherwise return **ENOSYS**.

## Airlock tightenings

### 1. Prepend explicit **EPERM** (`errnoRet` 1)

Deny syscalls Moby permits in its baseline allow-list but Airlock sandboxes do not need (viewer + offline triage on Alpine):

| Syscall(s) | Rationale |
|------------|-----------|
| `vmsplice`, `userfaultfd`, `kexec_*` | Kernel/memory attack surface; not required for userspace viewers. |
| `cachestat`, `futex_*`, `io_pgetevents*` | Moby allows on newer kernels; unused by KasmVNC/Chromium/Evince/LibreOffice/triage. |
| `migrate_pages`, `move_pages`, `map_shadow_stack` | NUMA/page migration; not needed. |
| `swapon` / `swapoff`, `nice`, `nfsservctl`, `pciconfig_*` | Privilege/admin paths irrelevant under non-root cap-drop. |
| Legacy `old*`, `vm86*`, `uselib`, `ustat`, `bdflush`, `sysfs`, `syscall` | Obsolete or admin interfaces. |

### 2. Append **EPERM** mirror rules (vs Moby)

Moby ends with capability-only **ALLOW** rules without matching denials. Airlock appends **EPERM** rules so missing capabilities fail closed with **EPERM** instead of default **ENOSYS** for: `open_by_handle_at`, admin mount/namespace set, `chroot`, module load, `acct`, ptrace-adjacent syscalls, raw I/O ports, time set, `vhangup`, `bpf`/`perf_event_open` without caps, and restricted `socket` families.

### Sandbox workloads

KasmVNC, supervisord, Xvfb, Openbox, Chromium, Evince, LibreOffice, ExifTool, YARA, oletools, zbar, ImageMagick, img2pdf, and `airlock-triage` / xray / flatten scripts (`packages/sandbox/Dockerfile`).
