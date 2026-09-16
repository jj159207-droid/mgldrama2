# Linux trailer encoder

The ffmpeg-static 5.3.0 Linux binary reports 7.0.2 and segfaults on ordinary local MPEG-TS files in CI and the verification container. Do not deploy that binary.

`postinstall` and `prebuild` provision the BtbN FFmpeg 8.1.2 Linux x64 monthly-retained release below. The archive SHA-256 and expected version are pinned in `scripts/provision-ffmpeg.mjs`. A failed download, checksum or version check fails the build. The marker also checks the installed binary hash to detect replacement by npm. Other operating systems retain ffmpeg-static's platform-specific binary.

Release: https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-08-31-13-27
Archive: ffmpeg-n8.1.2-50-g1a748fe2cd-linux64-gpl-8.1.tar.xz
SHA-256: c733b4b2951e5957e15505f788b2c65a7a41b6da4b289e295852cc38079b4d2b
Source/build instructions: https://github.com/BtbN/FFmpeg-Builds
FFmpeg source: https://github.com/FFmpeg/FFmpeg
This is a GPL-enabled build. Preserve applicable license and source notices when redistributing it. The binary is installed at build time and is not committed here.

CI uses explicit Bash fail-fast/pipefail behavior and tests raw npm exit statuses without a masking tee pipeline. Production traces are checked to include FFmpeg and stay under the function size cap. CI no longer auto-commits source changes.
