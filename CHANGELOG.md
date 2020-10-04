# Changelog
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2020-10-04
### Fixed
- Wrong status and error messages in scheduler node.
- Messages were enqueued by delay until node although an error occurred.
- Fixed wrong calling of done() function in delay until node.
- Delay timer was not stopped upon drop and flush of message queue.

### Changed
- Delay until node now shows error status in case of an error.
- Error details for scheduler and delay until node are now also contained in property "errorDetails" for consistency.
- Lists of scheduler, time switch and time filter node are now validated against being empty.

## [1.2.1] - 2020-10-03
### Fixed
- Avoid name clash with predefined sun positions by prefixing custom sun position names.
- Avoid name clash with existing property "errorDetails" in input messages by renaming it.

### Changed
- Restructured error details for catch node.

## [1.2.0] - 2020-09-28
### Added
- Possibility to add custom sun positions.
- Possibility to enable/disable single schedule events via input message.
- German localization for UI and help texts.

### Changed
- Minor layout optimization for scheduler node.

## [1.1.0] - 2020-09-26
### Added
- Possibility to specify offsets for time comparison conditions in switch and filter node.

## [1.0.2] - 2020-09-25
### Fixed
- Another fix for the configuration node icon.

## [1.0.1] - 2020-09-25
### Added
- Notice about issue tracker and roadmap in [README](README.md) file.
- Additional attribution for icons from Node-RED built-in nodes.

### Fixed
- Icons taken from Node-RED built-in nodes did not show up in overview page correctly.

## [1.0.0] - 2020-09-25
Initial release
