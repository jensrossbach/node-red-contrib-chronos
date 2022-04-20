# Changelog
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.17.2] - 2022-04-20

### Changed
- Further improvements for the sending of event time notifications.

## [1.17.1] - 2022-04-18

### Changed
- Improved event time notifications in a way that multiple subsequent messages with the same content are avoided.

## [1.17.0] - 2022-04-11

### Added
- Added possibility to activate dedicated output port for capturing schedule times of events.
- Added support for user specified time zones per configuration node.
- Added example flows for scheduler node (more will follow in future).

### Changed
- Improved tooltip texts for offset input.
- Updated versions of dependencies where possible.
- Dropped support for Node-RED versions older than 1.0.0.

### Fixed
- Fixed offset not being applied for sun/moon times when scheduled for next day.
- Fixed offset being applied only if dividable by 5.

## [1.16.0] - 2022-01-08

### Added
- Scheduler node now shows the date and time of next event in the status.
- Added possibility to specify repetition ending time as JSONata expression.
- Added new custom mode for repeat node which allows to calculate interval times using a JSONata expression.
- Added option to delay until and repeat node for ignoring control properties in input messages.
- Scheduler node now supports JSONata based output (for message properties and context variables as well as full messages).

### Changed
- Optimized error output for JSONata evaluation

### Fixed
- Fixed invalid handling of non-existing message properties in time change node.
- Fixed some help texts.

## [1.15.0] - 2021-11-23

### Added
- Added support for cron-like scheduling of repetition in the repeat node.
- Added possibility to specify the date for the ending time in the repeat node.
- Added the possibility to configure forwarding behavior on message ingress for the repeat node.

### Fixed
- Fixed potential crash of the repeat node when ending time is not calculatable.

## [1.14.0] - 2021-11-06

### Added
- Added support for overriding single or multiple schedule events of the scheduler node via input message.
- Added support for cron-like schedules in the scheduler node.

## [1.13.3] - 2021-09-27
### Fixed
- Implemented workaround for forced spinner input field width.

## [1.13.2] - 2021-08-28
### Fixed
- Fixed minor typos in help texts.

## [1.13.1] - 2021-08-21
### Changed
- Updated homepage link in _package.json_ file.

## [1.13.0] - 2021-07-23

---

### NOTE
**Please be aware that this version introduces a change that requires adaptation in case you are using the JSONata based filter result evaluation which has been introduced in version 1.12. The condition result array has been changed to be an expression variable instead of an input property. This means it has to be referenced as `$condition` instead of `condition` (note the prepended dollar sign) and any property from the input message with the name "condition" will no longer be renamed.**

---

### Added
- Added support for JSONata based time switch/filter node conditions.
- Added new set action based on JSONata expressions to time change node.

### Changed
- Condition result array in JSONata result evaluation of time filter node is now an expression variable instead of an input property.

## [1.12.0] - 2021-06-21
### Added
- New repeat node which repeats incoming messages periodically based on a configurable interval.
- Filter result of time filter node can now be evaluated via a JSONata expression for more complex evaluation.

### Changed
- UI text and translation improvements.

## [1.11.1] - 2021-05-30
### Fixed
- Fixed online help for time switch and filter nodes (missing documentation of `exclude` property).

### Changed
- Updated flow picture for scheduler node.

## [1.11.0] - 2021-05-29
### Added
- Enhanced input messages with control commands for scheduler node.
- Condition for special days of a month for time switch and filter nodes.

### Changed
- UI text and translation improvements.

## [1.10.4] - 2021-05-13
### Changed
- Moved sunlight phase "Night (end)" to beginning of lists.
- Minor code improvements.

## [1.10.3] - 2021-05-01
### Changed
- Sunlight phases are now shown in chronological order in the selection menus of the configuration UIs.

## [1.10.2] - 2021-04-15
### Fixed
- Fixed refusal of input messages with number-based target times for delay until nodes.

## [1.10.1] - 2021-04-13
### Fixed
- Added missing help texts for new functionality from release 1.10.0.

## [1.10.0] - 2021-04-13
### Added
- Added option to start scheduler node with disabled schedule.
- For dynamic time input via context variable (scheduler node) or input message (delay until node), it is now possible to specify the time as a number of milliseconds from midnight.

### Fixed
- Improved robustness against wrong user input for configuration node and scheduler node.

## [1.9.2] - 2021-02-20
### Changed
- Time calculation and conversion is now locale aware. This mostly affects time change node for day of week interpretation and string based time input/output.

### Fixed
- Fixed custom sun positions being registered multiple times.
- Fixed overwriting of geographical locations when having multiple configuration nodes.

## [1.9.1] - 2021-02-09
### Fixed
- Fixed empty values when changing to sun or moon position input without changing position selection (affected scheduler, time switch and time filter node).

## [1.9.0] - 2021-02-08
### Added
- Simplified context variable format for configuring only the trigger time of a schedule event dynamically. The "extended" format (including the output) from v1.8.x is still supported though.
- Delay until node now displays the actual target time in the status.
- The configured target time of delay until nodes can now be overridden by input messages.

### Fixed
- Fixed minor layout flaws in configuration pages.

## [1.8.1] - 2021-01-31
### Fixed
- Fixed missing German translation for operator/source list in time switch and filter nodes.

## [1.8.0] - 2021-01-10
### Added
- Schedule events can now be dynamically loaded from context variables.
- Time switch and filter conditions can now be dynamically loaded from context variables.

## [1.7.2] - 2020-12-25

### Fixed
- Fixed wrong interpretation of 12h time format causing an endless loop in scheduler node.

## [1.7.1] - 2020-12-22
### Added
- Scheduler node shows status of schedule (enabled/disabled) in editor.

### Fixed
- Fixed wrong handling of user-specified nested message properties.
- Fixed Node-RED 0.x backward compatible done function.

## [1.7.0] - 2020-11-25
### Added
- New time change node providing capabilities to set or modify date and time values from message properties, flow variables or global variables.

### Changed
- Minor internal code improvements.

## [1.6.1] - 2020-11-09
### Changed
- Internal code optimizations.

### Fixed
- Fixed wrong range check in switch/filter nodes when range crosses midnight border and base time is later than midnight.

## [1.6.0] - 2020-11-06
### Added
- Added support for specifying custom time bases from message properties, global variables and flow variables in switch and filter nodes.

### Fixed
- Scheduler node now checks if output property and variable names are not empty.
- Fixed handling of global/flow variables for multiple context stores in scheduler node.

## [1.5.0] - 2020-10-11
### Added
- Map based on [OpenStreetMap](https://www.openstreetmap.org) showing the entered geographic location in configuration node.

### Changed
- Translation for node labels in editor area.
- Improvements to German translation.

## [1.4.1] - 2020-10-08
### Changed
- Added link to repository wiki on sidebar help pages.
- Added more details to sidebar help for time input and switch/filter operators.

### Fixed
- Added missing documentation of "Annotation only" mode to sidebar help.

## [1.4.0] - 2020-10-07
### Added
- New operator "otherwise" in time switch node which is considered if all other conditions do not match.
- New "Annotation only" mode in time filter node which forwards messages in any case and annotates them with the results of each condition evaluation.

### Changed
- Height of list views is now scaling with height of configuration dialogs.
- Optimized message cloning behavior for switch node.

## [1.3.0] - 2020-10-05
### Added
- New option in scheduler node which creates dedicated output ports for events producing output messages.

### Changed
- Improved handling of invalid user input from configuration pages.

### Fixed
- Output message property type is always "string".

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
