# QRSCP

![npm](https://img.shields.io/npm/v/@ffimnsr/qrscp?style=flat-square) ![npm](https://img.shields.io/npm/l/@ffimnsr/qrscp?style=flat-square) ![npm](https://img.shields.io/npm/dm/@ffimnsr/qrscp?style=flat-square)

> Far out in the uncharted backwaters of the unfashionable end
> of the western spiral amr of the Galaxy lies a small,
> unregarded yellow sun.
> - from The Hitchhicker's Guide To The Galaxy by Douglas Adams

Quick QR file transfer over local connection.

## Commands

See `--help` for more info and commands.

- `qrscp transfer <file>` - Generate QR image to transfer file.
- `qrscp receive <directory>` - Receive files using multipart upload.

`qrscp` picks the first non-internal IPv4 address by default in non-interactive use. You can also select the bind target explicitly with `--host <ip>` or `--interface <name>`.

Directory transfer is not implemented. `transfer` accepts files only and will return a clean error for directories.

## Installation

To install this command line tool:

~~~bash
npm install -g @ffimnsr/qrscp
~~~

## Examples

~~~bash
qrscp transfer ./photo.jpg
qrscp transfer --host 192.168.1.25 ./photo.jpg
qrscp transfer --interface wlan0 ./photo.jpg
qrscp receive --port 8080 ./downloads
~~~

## Credits

Inspired by project [qr-filetransfer](https://github.com/claudiodangelis/qr-filetransfer) which is implemented in Golang.

## License

MIT © ffimnsr
