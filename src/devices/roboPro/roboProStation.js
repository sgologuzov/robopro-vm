/**
 * Robo Bot
 *
 * @overview Compared to the Arduino Uno, this control board use CH340 as
 * use to uart chip, uese oldbootloader to flash the firmware, and there are
 * more A6 and A7 pin options.
 */

const ArduinoPeripheral = require('../common/arduino-peripheral');
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const ProgramModeType = require('../../extension-support/program-mode-type');
const Cast = require('../../util/cast');
const MathUtil = require('../../util/math-util');
const OpenBlockArduinoUnoDevice = require('../arduinoUno/arduinoUno');
const pixel = require('../../lib/node-pixel');
const tm1637 = require('../../lib/TM1637Display');
const formatMessage = require('format-message');
const log = require('../../util/log');
const Color = require("../../util/color");

/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
// eslint-disable-next-line max-len
const blockIconURI = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB3aWR0aD0iMjdtbSIKICAgaGVpZ2h0PSIyN21tIgogICB2aWV3Qm94PSIwIDAgMjcgMjciCiAgIHZlcnNpb249IjEuMSIKICAgaWQ9InN2ZzMzOCIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMS4yLjIgKGIwYTg0ODY1NDEsIDIwMjItMTItMDEpIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0ibmFtZWR2aWV3MzQwIgogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxLjAiCiAgICAgaW5rc2NhcGU6c2hvd3BhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlY2hlY2tlcmJvYXJkPSIwIgogICAgIGlua3NjYXBlOmRlc2tjb2xvcj0iI2QxZDFkMSIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0ibW0iCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGlua3NjYXBlOnpvb209IjMuMTk5OTQzOSIKICAgICBpbmtzY2FwZTpjeD0iMTY1LjE1OTE1IgogICAgIGlua3NjYXBlOmN5PSIxMzguOTA4NjkiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxOTIwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjEyMzYiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9IjI1NjAiCiAgICAgaW5rc2NhcGU6d2luZG93LXk9IjAiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMCIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiIC8+CiAgPGRlZnMKICAgICBpZD0iZGVmczMzNSIgLz4KICA8ZwogICAgIGlua3NjYXBlOmxhYmVsPSJMYXllciAxIgogICAgIGlua3NjYXBlOmdyb3VwbW9kZT0ibGF5ZXIiCiAgICAgaWQ9ImxheWVyMSI+CiAgICA8cGF0aAogICAgICAgZD0iTSA2LjU5MzA0NzIsMjUuNDUxODMzIEggMTkuODYzODE3IGMgMC4wNTk5LC0wLjAxNzMyIDAuMTE4NSwtMC4wMzYxMiAwLjE4MDQ4LC0wLjA0NTUxIDEuNjI4MTgsLTAuMjQ3MzY3IDIuOTE0ODIsLTEuNzMwNDQyIDIuOTEyMzksLTMuMzc5NDYzIC03LjFlLTQsLTAuNDUxNTU1IC0wLjMyODQsLTAuNzk2OTIzIC0wLjc4NzI5LC0wLjc3NzE2OCAtMC40MDk0LDAuMDE3NjQgLTAuNjYwNTEsMC4zNDY5NTYgLTAuNjg1NTUsMC43MzczNCAtMC4wNzg3LDEuMjIwMzYxIC0wLjg5NzU0LDEuOTg4MDA0IC0yLjEyMDEyLDEuOTg5ODc0IC0wLjYwMDI1LDAuMDAxMSAtMS4yMDA1LDIuMTJlLTQgLTEuODAwNzUsMi4xMmUtNCBoIC0wLjUyOTI0IHYgLTAuNTM2NTA0IGMgMCwtMS4wMjk4OTcgMC4wMDEsLTIuMDU5NzU5IC0zLjVlLTQsLTMuMDg5NzYzIC03LjFlLTQsLTAuNTMwNDcgLTAuMjc5MTYsLTAuODMyNjI0IC0wLjgxNTk0LC0wLjgzMzQzNSAtMS45OTQ3MSwtMC4wMDI4IC0zLjk4OTU5LC0wLjAwMzIgLTUuOTg0MzQsMi4xMWUtNCAtMC41MTk2Njk4LDAuMDAxMSAtMC44MDY4Njk4LDAuMzAwNDI1IC0wLjgwNzc3OTgsMC44MTY5OTcgLTAuMDAyLDEuMDQ1OTg0IC03LjFlLTQsMi4wOTIwMDMgLTcuMWUtNCwzLjEzODAyMiB2IDAuNTA0NDcyIGggLTAuMjM1ODcgYyAtMC42OTI0MywwIC0xLjM4NDg2LDMuNTJlLTQgLTIuMDc3MjksLTIuMTJlLTQgLTEuMjkzMjQsLTAuMDAxMSAtMi4xMzU5OSwtMC44Mzk3NTEgLTIuMTM2MzUsLTIuMTM0MTYgLTAuMDAxLC00LjM3MTA0OSA3LjFlLTQsLTguNzQyMjA0IC0wLjAwNCwtMTMuMTEzMjE3OCAtMy42ZS00LC0wLjI0NTUzMyAwLjA4OTIsLTAuNDIwMjI4IDAuMjgyNDMsLTAuNTcwMDg4IDIuMjA5NDgsLTEuNzE0ODg1IDQuNDE0MzMsLTMuNDM1NTU1IDYuNjIxNDc5OCwtNS4xNTM0MzggMC44OTc4OSwtMC42OTg5MjIgMS44MDY0NywtMC43MDU3NjYgMi43MDU4OCwtMC4wMDUyIDIuMjA2NTgsMS43MTg0ODMgNC40MTEwOCwzLjQzOTUwNiA2LjYyMDgxLDUuMTUzODk3IDAuMjAxNTEsMC4xNTYzNSAwLjI4NjYsMC4zMzk2NTMgMC4yODYsMC41OTM4NjQgLTAuMDA1LDIuNzE2NTI0OCAtMC4wMDQsNS40MzMxOTA4IC0wLjAwNCw4LjE0OTgyMDggMCwwLjA5OTAzIC0wLjAwMiwwLjE5ODYxNCAwLjAwNSwwLjI5NzQyNyAwLjAzMzUsMC40MjIxNjggMC40NjA2MiwwLjczMzQ5NCAwLjg3MzA1LDAuNjM5OTM3IDAuNDIyNTIsLTAuMDk1ODkgMC41OTQ3OCwtMC40MTQ0MDcgMC41OTUwMywtMC44Mjc2NSAwLjAwMSwtMS4zNDc1NzMgMC4wMDEsLTIuNjk1MDc2IDAuMDAxLC00LjA0MjY0OSBoIDEuNGUtNCBsIC0xLjRlLTQsLTAuMDE5NTEgdiAtMC4xMDQxMDQgbCAtMS4xZS00LC0yLjQ5MzUzNCBWIDkuNTQ1ODAzMiBsIDEuNTM5OTQsMS4yMTc5Mjc4IGMgMC4yMTIzLDAuMTYxOTI1IDAuNDQ1OTgsMC4yOTI0MTcgMC43MjIwMywwLjIyODIxMiAwLjMwMDY0LC0wLjA2OTg5IDAuNDk0MzgsLTAuMjQyODE3IDAuNTY4ODksLTAuNTQ1OTIzIDAuMDc1NiwtMC4zMDc3MjcgLTAuMDE1LC0wLjU1OTc1MDggLTAuMjYyMTEsLTAuNzU2MjQ3OCAtMC4yNDIwMSwtMC4xOTIzNyAtMC42NjUwMiwtMC41MjcwMTQgLTEuMTI2ODEsLTAuODkxNjQ0IC0wLjAzNTQsLTAuMDM2NTUgLTAuMDczOSwtMC4wNzEyNiAtMC4xMTUsLTAuMTAzNjQ2IC0wLjM1Mzg0LC0wLjI3ODcyOSAtMC43MDU0NSwtMC41NjAzMTYgLTEuMDY3NjEsLTAuODI4MjUgbCAtMC4wNDQ0LC0wLjAzNDkzIGMgLTAuMTU1NjgsLTAuMTMxODY4IC0wLjIxOTY0LC0wLjI5MzMzNCAtMC4yMTgyMywtMC41MDQ2MTMgMC4wMDYsLTAuOTU2NDEzIDAuMDA0LC0xLjkxMjc5MiAwLjAwMiwtMi44NjkxNzEgLTEuMWUtNCwtMC4wODQ3NCAzLjVlLTQsLTAuMTcxMTMyIC0wLjAxMjQsLTAuMjU1MjY5IC0wLjA1NjMsLTAuMzY3MTcxIC0wLjM2OTk2LC0wLjY2Njk5NiAtMC43NTA5MiwtMC42NDg0NCAtMC40MDczNSwwLjAxOTg2IC0wLjY5OTg4LDAuMzI2Nzc4IC0wLjcwNzQyLDAuNzMzMjgzIC0wLjAwOSwwLjQ5MzQ2NCAtMC4wMDIsMC45ODcwMzUgLTAuMDA0LDEuNDgwNDk5IC0yLjVlLTQsMC4wODQyOCAtMC4wMTE1LDAuMTY3Mjg3IC0wLjAxOCwwLjI1MDk2NiBsIC0wLjAzMjQsMC40MTY3MzUgLTAuMzQwMTEsLTAuMjQzMDYzIGMgLTAuMDc3MSwtMC4wNTUwMyAtMC4xNTYwMywtMC4xMDc0OTEgLTAuMjMwNzgsLTAuMTY1NzcgLTEuNzkwNTYsLTEuMzk1NDEgLTMuNTgxMjIsLTIuNzkwNzE0IC01LjM3MDk3LC00LjE4NzA0MSAtMS40MjAyNCwtMS4xMDgxMDggLTMuMDk5NzEsLTEuMTExMTQyIC00LjUyMDIsLTAuMDAxOCAtMi4zMzg0NDk4LDEuODI2NDMyIC00LjY4MDI1OTgsMy42NDg2NjcgLTcuMDIwNjg5OCw1LjQ3MjY2NiAtMC42MTk3NSwwLjQ4Mjg4MSAtMi40MDM1NywxLjg5MDQ5NyAtMy4wMTg1Njk5OSwyLjM3OTQ0NiAtMC4yNDcxNSwwLjE5NjQ5NyAtMC4zMzc3MSwwLjQ0ODUyMDggLTAuMjYyMTEsMC43NTYyNDc4IDAuMDc0NSwwLjMwMzEwNiAwLjI2ODI1LDAuNDc2MDM3IDAuNTY4ODg5OTksMC41NDU5MjMgMC4yNzYwNCwwLjA2NDIxIDAuNTA5NzIsLTAuMDY2MjkgMC43MjIwMywtMC4yMjgyMTIgbCAxLjUzOTk0LC0xLjIxNzkyNzggdiAwLjgwMjQ5NzggYyAwLDMuODUyMTQ5IC0wLjAwMiw3LjcwNDI5OCAwLjAwMSwxMS41NTYzNDIgMTBlLTQsMS41MjI5NzQgMC44NDkxMywyLjc5MjQ0MiAyLjI4MjA0LDMuMzI5MTkyIDAuMjYyMDEsMC4wOTgxMSAwLjUzOTY4LDAuMTQ3ODg1IDAuODA5OTEsMC4yMTgwMTcgeiBtIDQuMzE2ODI5OCwtMS40OTIgdiAtMi45NTM1NTYgaCA0LjYzODQ5IHYgMi45NTM1NTYgeiIKICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlLXdpZHRoOjAuMzUyNzc3O2ZpbGwtb3BhY2l0eToxIgogICAgICAgaWQ9InBhdGg2NiIgLz4KICA8L2c+Cjwvc3ZnPgo=';
/**
 * Icon svg to be displayed in the category menu, encoded as a data URI.
 * @type {string}
 */
// eslint-disable-next-line max-len
const menuIconURI = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB3aWR0aD0iMjdtbSIKICAgaGVpZ2h0PSIyN21tIgogICB2aWV3Qm94PSIwIDAgMjcgMjciCiAgIHZlcnNpb249IjEuMSIKICAgaWQ9InN2ZzMzOCIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMS4yLjIgKGIwYTg0ODY1NDEsIDIwMjItMTItMDEpIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0ibmFtZWR2aWV3MzQwIgogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxLjAiCiAgICAgaW5rc2NhcGU6c2hvd3BhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlY2hlY2tlcmJvYXJkPSIwIgogICAgIGlua3NjYXBlOmRlc2tjb2xvcj0iI2QxZDFkMSIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0ibW0iCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGlua3NjYXBlOnpvb209IjMuMTk5OTQzOSIKICAgICBpbmtzY2FwZTpjeD0iMjE1Ljk0MTI5IgogICAgIGlua3NjYXBlOmN5PSIxMzguOTA4NjkiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxOTIwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjEyMzYiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9IjI1NjAiCiAgICAgaW5rc2NhcGU6d2luZG93LXk9IjAiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMCIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiIC8+CiAgPGRlZnMKICAgICBpZD0iZGVmczMzNSIgLz4KICA8ZwogICAgIGlua3NjYXBlOmxhYmVsPSJMYXllciAxIgogICAgIGlua3NjYXBlOmdyb3VwbW9kZT0ibGF5ZXIiCiAgICAgaWQ9ImxheWVyMSI+CiAgICA8cGF0aAogICAgICAgZD0iTSA2LjU5MzA0NzIsMjUuNDUxODMzIEggMTkuODYzODE3IGMgMC4wNTk5LC0wLjAxNzMyIDAuMTE4NSwtMC4wMzYxMiAwLjE4MDQ4LC0wLjA0NTUxIDEuNjI4MTgsLTAuMjQ3MzY3IDIuOTE0ODIsLTEuNzMwNDQyIDIuOTEyMzksLTMuMzc5NDYzIC03LjFlLTQsLTAuNDUxNTU1IC0wLjMyODQsLTAuNzk2OTIzIC0wLjc4NzI5LC0wLjc3NzE2OCAtMC40MDk0LDAuMDE3NjQgLTAuNjYwNTEsMC4zNDY5NTYgLTAuNjg1NTUsMC43MzczNCAtMC4wNzg3LDEuMjIwMzYxIC0wLjg5NzU0LDEuOTg4MDA0IC0yLjEyMDEyLDEuOTg5ODc0IC0wLjYwMDI1LDAuMDAxMSAtMS4yMDA1LDIuMTJlLTQgLTEuODAwNzUsMi4xMmUtNCBoIC0wLjUyOTI0IHYgLTAuNTM2NTA0IGMgMCwtMS4wMjk4OTcgMC4wMDEsLTIuMDU5NzU5IC0zLjVlLTQsLTMuMDg5NzYzIC03LjFlLTQsLTAuNTMwNDcgLTAuMjc5MTYsLTAuODMyNjI0IC0wLjgxNTk0LC0wLjgzMzQzNSAtMS45OTQ3MSwtMC4wMDI4IC0zLjk4OTU5LC0wLjAwMzIgLTUuOTg0MzQsMi4xMWUtNCAtMC41MTk2Njk4LDAuMDAxMSAtMC44MDY4Njk4LDAuMzAwNDI1IC0wLjgwNzc3OTgsMC44MTY5OTcgLTAuMDAyLDEuMDQ1OTg0IC03LjFlLTQsMi4wOTIwMDMgLTcuMWUtNCwzLjEzODAyMiB2IDAuNTA0NDcyIGggLTAuMjM1ODcgYyAtMC42OTI0MywwIC0xLjM4NDg2LDMuNTJlLTQgLTIuMDc3MjksLTIuMTJlLTQgLTEuMjkzMjQsLTAuMDAxMSAtMi4xMzU5OSwtMC44Mzk3NTEgLTIuMTM2MzUsLTIuMTM0MTYgLTAuMDAxLC00LjM3MTA0OSA3LjFlLTQsLTguNzQyMjA0IC0wLjAwNCwtMTMuMTEzMjE3OCAtMy42ZS00LC0wLjI0NTUzMyAwLjA4OTIsLTAuNDIwMjI4IDAuMjgyNDMsLTAuNTcwMDg4IDIuMjA5NDgsLTEuNzE0ODg1IDQuNDE0MzMsLTMuNDM1NTU1IDYuNjIxNDc5OCwtNS4xNTM0MzggMC44OTc4OSwtMC42OTg5MjIgMS44MDY0NywtMC43MDU3NjYgMi43MDU4OCwtMC4wMDUyIDIuMjA2NTgsMS43MTg0ODMgNC40MTEwOCwzLjQzOTUwNiA2LjYyMDgxLDUuMTUzODk3IDAuMjAxNTEsMC4xNTYzNSAwLjI4NjYsMC4zMzk2NTMgMC4yODYsMC41OTM4NjQgLTAuMDA1LDIuNzE2NTI0OCAtMC4wMDQsNS40MzMxOTA4IC0wLjAwNCw4LjE0OTgyMDggMCwwLjA5OTAzIC0wLjAwMiwwLjE5ODYxNCAwLjAwNSwwLjI5NzQyNyAwLjAzMzUsMC40MjIxNjggMC40NjA2MiwwLjczMzQ5NCAwLjg3MzA1LDAuNjM5OTM3IDAuNDIyNTIsLTAuMDk1ODkgMC41OTQ3OCwtMC40MTQ0MDcgMC41OTUwMywtMC44Mjc2NSAwLjAwMSwtMS4zNDc1NzMgMC4wMDEsLTIuNjk1MDc2IDAuMDAxLC00LjA0MjY0OSBoIDEuNGUtNCBsIC0xLjRlLTQsLTAuMDE5NTEgdiAtMC4xMDQxMDQgbCAtMS4xZS00LC0yLjQ5MzUzNCBWIDkuNTQ1ODAzMiBsIDEuNTM5OTQsMS4yMTc5Mjc4IGMgMC4yMTIzLDAuMTYxOTI1IDAuNDQ1OTgsMC4yOTI0MTcgMC43MjIwMywwLjIyODIxMiAwLjMwMDY0LC0wLjA2OTg5IDAuNDk0MzgsLTAuMjQyODE3IDAuNTY4ODksLTAuNTQ1OTIzIDAuMDc1NiwtMC4zMDc3MjcgLTAuMDE1LC0wLjU1OTc1MDggLTAuMjYyMTEsLTAuNzU2MjQ3OCAtMC4yNDIwMSwtMC4xOTIzNyAtMC42NjUwMiwtMC41MjcwMTQgLTEuMTI2ODEsLTAuODkxNjQ0IC0wLjAzNTQsLTAuMDM2NTUgLTAuMDczOSwtMC4wNzEyNiAtMC4xMTUsLTAuMTAzNjQ2IC0wLjM1Mzg0LC0wLjI3ODcyOSAtMC43MDU0NSwtMC41NjAzMTYgLTEuMDY3NjEsLTAuODI4MjUgbCAtMC4wNDQ0LC0wLjAzNDkzIGMgLTAuMTU1NjgsLTAuMTMxODY4IC0wLjIxOTY0LC0wLjI5MzMzNCAtMC4yMTgyMywtMC41MDQ2MTMgMC4wMDYsLTAuOTU2NDEzIDAuMDA0LC0xLjkxMjc5MiAwLjAwMiwtMi44NjkxNzEgLTEuMWUtNCwtMC4wODQ3NCAzLjVlLTQsLTAuMTcxMTMyIC0wLjAxMjQsLTAuMjU1MjY5IC0wLjA1NjMsLTAuMzY3MTcxIC0wLjM2OTk2LC0wLjY2Njk5NiAtMC43NTA5MiwtMC42NDg0NCAtMC40MDczNSwwLjAxOTg2IC0wLjY5OTg4LDAuMzI2Nzc4IC0wLjcwNzQyLDAuNzMzMjgzIC0wLjAwOSwwLjQ5MzQ2NCAtMC4wMDIsMC45ODcwMzUgLTAuMDA0LDEuNDgwNDk5IC0yLjVlLTQsMC4wODQyOCAtMC4wMTE1LDAuMTY3Mjg3IC0wLjAxOCwwLjI1MDk2NiBsIC0wLjAzMjQsMC40MTY3MzUgLTAuMzQwMTEsLTAuMjQzMDYzIGMgLTAuMDc3MSwtMC4wNTUwMyAtMC4xNTYwMywtMC4xMDc0OTEgLTAuMjMwNzgsLTAuMTY1NzcgLTEuNzkwNTYsLTEuMzk1NDEgLTMuNTgxMjIsLTIuNzkwNzE0IC01LjM3MDk3LC00LjE4NzA0MSAtMS40MjAyNCwtMS4xMDgxMDggLTMuMDk5NzEsLTEuMTExMTQyIC00LjUyMDIsLTAuMDAxOCAtMi4zMzg0NDk4LDEuODI2NDMyIC00LjY4MDI1OTgsMy42NDg2NjcgLTcuMDIwNjg5OCw1LjQ3MjY2NiAtMC42MTk3NSwwLjQ4Mjg4MSAtMi40MDM1NywxLjg5MDQ5NyAtMy4wMTg1Njk5OSwyLjM3OTQ0NiAtMC4yNDcxNSwwLjE5NjQ5NyAtMC4zMzc3MSwwLjQ0ODUyMDggLTAuMjYyMTEsMC43NTYyNDc4IDAuMDc0NSwwLjMwMzEwNiAwLjI2ODI1LDAuNDc2MDM3IDAuNTY4ODg5OTksMC41NDU5MjMgMC4yNzYwNCwwLjA2NDIxIDAuNTA5NzIsLTAuMDY2MjkgMC43MjIwMywtMC4yMjgyMTIgbCAxLjUzOTk0LC0xLjIxNzkyNzggdiAwLjgwMjQ5NzggYyAwLDMuODUyMTQ5IC0wLjAwMiw3LjcwNDI5OCAwLjAwMSwxMS41NTYzNDIgMTBlLTQsMS41MjI5NzQgMC44NDkxMywyLjc5MjQ0MiAyLjI4MjA0LDMuMzI5MTkyIDAuMjYyMDEsMC4wOTgxMSAwLjUzOTY4LDAuMTQ3ODg1IDAuODA5OTEsMC4yMTgwMTcgeiBtIDQuMzE2ODI5OCwtMS40OTIgdiAtMi45NTM1NTYgaCA0LjYzODQ5IHYgMi45NTM1NTYgeiIKICAgICAgIHN0eWxlPSJmaWxsOiMxYjE5MTg7ZmlsbC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlLXdpZHRoOjAuMzUyNzc3IgogICAgICAgaWQ9InBhdGg2NiIgLz4KICA8L2c+Cjwvc3ZnPgo=';

/**
 * The list of USB device filters.
 * @readonly
 */
const PNPID_LIST = [
    // Arduino UNO
    'USB\\VID_2341&PID_0043',
    // For chinese clones that use CH340
    'USB\\VID_1A86&PID_7523'
];

/**
 * Configuration of serialport
 * @readonly
 */
const SERIAL_CONFIG = {
    baudRate: 57600,
    dataBits: 8,
    stopBits: 1
};

/**
 * Configuration for arduino-cli.
 * @readonly
 */
const DEVICE_OPT = {
    type: 'arduino',
    fqbn: 'arduino:avr:uno',
    firmware: 'arduinoUno.hex'
};

const Pins = {
    D0: '0',
    D1: '1',
    D2: '2',
    D3: '3',
    D4: '4',
    D5: '5',
    D6: '6',
    D7: '7',
    D8: '8',
    D9: '9',
    D10: '10',
    D11: '11',
    D12: '12',
    D13: '13',
    A0: 'A0',
    A1: 'A1',
    A2: 'A2',
    A3: 'A3',
    A4: 'A4',
    A5: 'A5'
};

const Level = {
    High: 'HIGH',
    Low: 'LOW'
};

const Buadrate = {
    B4800: '4800',
    B9600: '9600',
    B19200: '19200',
    B38400: '38400',
    B57600: '57600',
    B76800: '76800',
    B115200: '115200'
};

const Eol = {
    Warp: 'warp',
    NoWarp: 'noWarp'
};

const Mode = {
    Input: 'INPUT',
    Output: 'OUTPUT',
    InputPullup: 'INPUT_PULLUP',
    I2C: 'I2C',
    OneWire: 'ONEWIRE'
};

const PinsMap = {
    // RoboPro
    DataLED: Pins.D2,
    Buzzer: Pins.D3,
    ClkLED: Pins.D4,
    GreenLED: Pins.D5,
    YellowLED: Pins.D6,
    RedLED: Pins.D7,
    Button1: Pins.D8,
    Button2: Pins.D9,
    Button3: Pins.D10,
    Button4: Pins.D12,
    Button5: Pins.D11,
    LEDStrip: Pins.D13,
    TempSensor: Pins.A0,
    ExtSensor2: Pins.A1,
    Slider: Pins.A2,
    SoundSensor: Pins.A3,
    LightSensor: Pins.A4,
    LatchLED: Pins.A5
};

const MonitoringPins = ['D8', 'D9', 'D10', 'D11', 'D12', 'A0', 'A2', 'A3', 'A4'];

const IN_SENSOR_MIN = 0;
const IN_SOUND_SENSOR_MIN = 200;
const IN_SENSOR_MAX = 1023;
const OUT_SENSOR_MIN = 0;
const OUT_SENSOR_MAX = 100;
const LED_STRIP_LENGTH = 8;
const LED_STRIP_BLACK_COLOR = '#000';
// const TEMP_VOLTS_PER_DEGREE = 0.02; // 0.02 for TMP37, 0.01 for TMP35/36
// const TEMP_OUTPUT_VOLTAGE = 0.25; // 0.25 for TMP35, 0.75 for TMP36, 0.5 for TMP37
// const TEMP_OFFSET_VALUE = TEMP_OUTPUT_VOLTAGE - (25 * TEMP_VOLTS_PER_DEGREE); // calculating the offset for 0 °C

/**
 * Manage communication with an Arduino Nano peripheral over a OpenBlock Link client socket.
 */
class RoboProStation extends ArduinoPeripheral {
    /**
     * Construct an Arduino communication object.
     * @param {Runtime} runtime - the OpenBlock runtime
     * @param {string} deviceId - the id of the extension
     * @param {string} originalDeviceId - the original id of the peripheral, like xxx_arduinoUno
     */
    constructor (runtime, deviceId, originalDeviceId) {
        super(runtime, deviceId, originalDeviceId, PNPID_LIST, SERIAL_CONFIG, DEVICE_OPT, Pins, MonitoringPins);
    }

    /**
     * Re-maps sensor value from the 0...1023 range to the 0...100 range.
     * @param {Pins} pin - sensor pin
     * @param {number} value - value from the sensor.
     * @return {number} re-mapped value
     * @private
     */
    mapPinValue (pin, value) {
        let inSensorMin = IN_SENSOR_MIN;
        switch (pin) {
        case PinsMap.TempSensor: {
            // const volts = value * 5.0 / 1024.0;
            return Math.round(value);
        }
        case PinsMap.LightSensor:
            value = IN_SENSOR_MAX - value;
            break;
        case PinsMap.SoundSensor:
            inSensorMin = IN_SOUND_SENSOR_MIN;
            break;
        }
        switch (pin) {
        case Pins.A0:
        case Pins.A1:
        case Pins.A2:
        case Pins.A3:
        case Pins.A4:
            value = ((value - inSensorMin) * (OUT_SENSOR_MAX - OUT_SENSOR_MIN) / (IN_SENSOR_MAX - inSensorMin)) +
                OUT_SENSOR_MIN;
            return Math.round(value);
        }
        return value;
    }
}

/**
 * OpenBlock blocks to interact with an Arduino Nano Ultra peripheral.
 */
class OpenBlockRoboProStationDevice extends OpenBlockArduinoUnoDevice {

    /**
     * The minimum and maximum MIDI note numbers, for clamping the input to play note.
     * @type {{min: number, max: number}}
     */
    static get MIDI_NOTE_RANGE () {
        return {min: 0, max: 130};
    }

    /**
     * The minimum and maximum beat values, for clamping the duration of play note, play drum and rest.
     * 100 beats at the default tempo of 60bpm is 100 seconds.
     * @type {{min: number, max: number}}
     */
    static get BEAT_RANGE () {
        return {min: 0, max: 100};
    }

    /**
     * @return {string} - the ID of this extension.
     */
    get DEVICE_ID () {
        return 'roboProStation';
    }

    get BUTTONS_MENU () {
        return [
            {
                text: '1',
                value: PinsMap.Button1
            },
            {
                text: '2',
                value: PinsMap.Button2
            },
            {
                text: '3',
                value: PinsMap.Button3
            },
            {
                text: '4',
                value: PinsMap.Button4
            },
            {
                text: '5',
                value: PinsMap.Button5
            }
        ];
    }

    get COLOR_LEDS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'roboPro.colorLedsMenu.red',
                    default: 'red',
                    description: 'label for red LED'
                }),
                value: PinsMap.RedLED
            },
            {
                text: formatMessage({
                    id: 'roboPro.colorLedsMenu.yellow',
                    default: 'yellow',
                    description: 'label for yellow LED'
                }),
                value: PinsMap.YellowLED
            },
            {
                text: formatMessage({
                    id: 'roboPro.colorLedsMenu.green',
                    default: 'green',
                    description: 'label for green LED'
                }),
                value: PinsMap.GreenLED
            }
        ];
    }

    get DIGITAL_INPUT_PINS_MENU () {
        return [
            {
                text: 'D8',
                value: Pins.D8
            },
            {
                text: 'D9',
                value: Pins.D9
            },
            {
                text: 'D10',
                value: Pins.D10
            },
            {
                text: 'D11',
                value: Pins.D11
            },
            {
                text: 'D12',
                value: Pins.D12
            },
            {
                text: 'D13',
                value: Pins.D13
            }
        ];
    }

    get DIGITAL_OUTPUT_PINS_MENU () {
        return [
            {
                text: 'D2',
                value: Pins.D2
            },
            {
                text: 'D3',
                value: Pins.D3
            },
            {
                text: 'D4',
                value: Pins.D4
            },
            {
                text: 'D5',
                value: Pins.D5
            },
            {
                text: 'D6',
                value: Pins.D6
            },
            {
                text: 'D7',
                value: Pins.D7
            }
        ];
    }

    get LEDS_MENU () {
        return [
            {
                text: '0',
                value: 0
            },
            {
                text: '1',
                value: 1
            },
            {
                text: '2',
                value: 2
            },
            {
                text: '3',
                value: 3
            },
            {
                text: '4',
                value: 4
            },
            {
                text: '5',
                value: 5
            },
            {
                text: '6',
                value: 6
            },
            {
                text: '7',
                value: 7
            },
            {
                text: '8',
                value: 8
            },
            {
                text: '9',
                value: 9
            },
            {
                text: '10',
                value: 10
            },
            {
                text: '11',
                value: 11
            },
            {
                text: '12',
                value: 12
            },
            {
                text: '13',
                value: 13
            },
            {
                text: '14',
                value: 14
            },
            {
                text: '15',
                value: 15
            }
        ];
    }

    get PWM_PINS_MENU () {
        return [
            {
                text: 'D3',
                value: Pins.D3
            },
            {
                text: 'D5',
                value: Pins.D5
            },
            {
                text: 'D6',
                value: Pins.D6
            }
        ];
    }

    get SENSORS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'roboPro.sensorsMenu.lightSensor',
                    default: 'light sensor',
                    description: 'label for light sensor'
                }),
                value: PinsMap.LightSensor
            },
            {
                text: formatMessage({
                    id: 'roboPro.sensorsMenu.soundSensor',
                    default: 'sound sensor',
                    description: 'label for sound sensor'
                }),
                value: PinsMap.SoundSensor
            },
            {
                text: formatMessage({
                    id: 'roboPro.sensorsMenu.tempSensor',
                    default: 'temperature sensor',
                    description: 'label for temperature sensor'
                }),
                value: PinsMap.TempSensor
            },
            {
                text: formatMessage({
                    id: 'roboPro.sensorsMenu.slider',
                    default: 'slider',
                    description: 'label for slider'
                }),
                value: PinsMap.Slider
            }
        ];
    }

    get INDICATOR_BRIGHTNESS_MENU () {
        return [
            {
                text: '0',
                value: 0
            },
            {
                text: '1',
                value: 1
            },
            {
                text: '2',
                value: 2
            },
            {
                text: '3',
                value: 3
            },
            {
                text: '4',
                value: 4
            },
            {
                text: '5',
                value: 5
            },
            {
                text: '6',
                value: 6
            },
            {
                text: '7',
                value: 7
            }
        ];
    }

    get INDICATOR_DIGITS_MENU () {
        return [
            {
                text: '1',
                value: 0
            },
            {
                text: '2',
                value: 1
            },
            {
                text: '3',
                value: 2
            },
            {
                text: '4',
                value: 3
            }
        ];
    }

    get INDICATOR_VALUES_MENU () {
        return [
            {
                text: '',
                value: ''
            },
            {
                text: '0',
                value: '0'
            },
            {
                text: '1',
                value: '1'
            },
            {
                text: '2',
                value: '2'
            },
            {
                text: '3',
                value: '3'
            },
            {
                text: '4',
                value: '4'
            },
            {
                text: '5',
                value: '5'
            },
            {
                text: '6',
                value: '6'
            },
            {
                text: '7',
                value: '7'
            },
            {
                text: '8',
                value: '8'
            },
            {
                text: '9',
                value: '9'
            },
            {
                text: '9',
                value: '9'
            },
            {
                text: 'A',
                value: 'A'
            },
            {
                text: 'C',
                value: 'C'
            },
            {
                text: 'F',
                value: 'F'
            },
            {
                text: '-',
                value: '-'
            },
            {
                text: '\u00B0C',
                value: '\u00B0C'
            }
        ];
    }

    get ON_OFF_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'roboPro.onOffMenu.on',
                    default: 'on',
                    description: 'label for on'
                }),
                value: 'on'
            },
            {
                text: formatMessage({
                    id: 'roboPro.onOffMenu.off',
                    default: 'off',
                    description: 'label for off'
                }),
                value: 'off'
            }
        ];
    }

    /**
     * Construct a set of Arduino blocks.
     * @param {Runtime} runtime - the OpenBlock runtime.
     * @param {string} originalDeviceId - the original id of the peripheral, like xxx_arduinoUno
     */
    constructor (runtime, originalDeviceId) {
        super(runtime, originalDeviceId);
        this._init = this._init.bind(this);

        // Create a new Arduino Nano peripheral instance
        this._peripheral = new RoboProStation(this.runtime, this.DEVICE_ID, originalDeviceId);
        this._peripheral.on('connected', this._init);
    }

    _init () {
        this._peripheral.setPinMode(PinsMap.TempSensor, Mode.OneWire);
        this._peripheral.setPinMode(PinsMap.LatchLED, Mode.Output);
        this._peripheral.setPinMode(PinsMap.Button1, Mode.InputPullup);
        this._peripheral.setPinMode(PinsMap.Button2, Mode.InputPullup);
        this._peripheral.setPinMode(PinsMap.Button3, Mode.InputPullup);
        this._peripheral.setPinMode(PinsMap.Button4, Mode.InputPullup);
        this._peripheral.setPinMode(PinsMap.Button5, Mode.InputPullup);
        this.display = tm1637({
            clk: PinsMap.ClkLED,
            dio: PinsMap.DataLED,
            board: this._peripheral._firmata
        });
        this.strip = new pixel.Strip({
            data: PinsMap.LEDStrip,
            length: LED_STRIP_LENGTH,
            firmata: this._peripheral._firmata,
            skip_firmware_check: true
        });
    }

    /**
     * @returns {Array.<object>} metadata for this extension and its blocks.
     */
    getInfo () {
        return [
            {
                id: 'roboProStation',
                name: formatMessage({
                    id: 'roboPro.category.roboProStation',
                    default: 'Robo Station',
                    description: 'The name of the arduino uno device pin category'
                }),
                blockIconURI: blockIconURI,
                menuIconURI: menuIconURI,
                color1: '#989898',
                color2: '#989898',
                color3: '#000000',

                blocks: [
                    {
                        opcode: 'ledPixelTurn',
                        text: formatMessage({
                            id: 'roboPro.station.ledPixelTurn',
                            default: 'turn LED [LED_INDEX] [COLOR] [VALUE]',
                            description: 'Turn LED'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            LED_INDEX: {
                                type: ArgumentType.NUMBER,
                                menu: 'leds',
                                defaultValue: 0
                            },
                            COLOR: {
                                type: ArgumentType.COLOR,
                                defaultValue: '#f00'
                            },
                            VALUE: {
                                type: ArgumentType.STRING,
                                menu: 'onOff',
                                defaultValue: 'on'
                            }
                        }
                    },
                    {
                        opcode: 'ledTurn',
                        text: formatMessage({
                            id: 'roboPro.station.ledTurn',
                            default: 'turn LED [COLOR] [VALUE]',
                            description: 'Turn LED'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            COLOR: {
                                type: ArgumentType.COLOR,
                                defaultValue: '#f00'
                            },
                            VALUE: {
                                type: ArgumentType.STRING,
                                menu: 'onOff',
                                defaultValue: 'on'
                            }
                        }
                    },
                    {
                        opcode: 'colorLedTurn',
                        text: formatMessage({
                            id: 'roboPro.station.colorLedTurn',
                            default: 'turn LED [LED_PIN] [VALUE]',
                            description: 'Turn LED on'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            LED_PIN: {
                                type: ArgumentType.STRING,
                                menu: 'colorLeds',
                                defaultValue: PinsMap.RedLED
                            },
                            VALUE: {
                                type: ArgumentType.STRING,
                                menu: 'onOff',
                                defaultValue: 'on'
                            }
                        }
                    },
                    {
                        opcode: 'playNoteForBeats',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'roboPro.station.playNoteForBeats',
                            default: 'play note [NOTE] for [BEATS] beats',
                            description: 'play a note for a number of beats'
                        }),
                        arguments: {
                            NOTE: {
                                type: ArgumentType.NOTE,
                                defaultValue: 60
                            },
                            BEATS: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 0.25
                            }
                        }
                    },
                    {
                        opcode: 'readSensor',
                        text: formatMessage({
                            id: 'roboPro.station.readSensor',
                            default: 'read [PIN]',
                            description: 'play a note'
                        }),
                        blockType: BlockType.REPORTER,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'sensors',
                                defaultValue: PinsMap.LightSensor
                            }
                        }
                    },
                    {
                        opcode: 'readButton',
                        text: formatMessage({
                            id: 'roboPro.station.readButton',
                            default: 'button [PIN] pressed',
                            description: 'roboProStation read button'
                        }),
                        blockType: BlockType.BOOLEAN,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'buttons',
                                defaultValue: PinsMap.Button1
                            }
                        }
                    },
                    {
                        opcode: 'readAnalogSensor',
                        text: formatMessage({
                            id: 'roboPro.station.readAnalogSensor',
                            default: 'read pin [PIN]',
                            description: 'roboProStation read analog pin'
                        }),
                        blockType: BlockType.REPORTER,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'analogPins',
                                defaultValue: Pins.A0
                            }
                        }
                    },
                    {
                        opcode: 'readDigitalPin',
                        text: formatMessage({
                            id: 'roboPro.station.readDigitalPin',
                            default: 'read pin [PIN]',
                            description: 'roboProStation read digital pin'
                        }),
                        blockType: BlockType.BOOLEAN,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'digitalInputPins',
                                defaultValue: Pins.D8
                            }
                        }
                    },
                    {
                        opcode: 'setDigitalOutput',
                        text: formatMessage({
                            id: 'roboPro.station.setDigitalOutput',
                            default: 'set pin [PIN] out [LEVEL]',
                            description: 'roboProStation set digital pin out'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'digitalOutputPins',
                                defaultValue: Pins.D2
                            },
                            LEVEL: {
                                type: ArgumentType.STRING,
                                menu: 'level',
                                defaultValue: Level.High
                            }
                        }
                    },
                    {
                        opcode: 'setPwmOutput',
                        text: formatMessage({
                            id: 'roboPro.station.setPwmOutput',
                            default: 'set pwm pin [PIN] out [OUT]',
                            description: 'roboProStation set pwm pin out'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'pwmPins',
                                defaultValue: Pins.D3
                            },
                            OUT: {
                                type: ArgumentType.UINT8_NUMBER,
                                defaultValue: '255'
                            }
                        }
                    },
                    {
                        opcode: 'setIndicatorBrightness',
                        text: formatMessage({
                            id: 'roboPro.station.setIndicatorBrightness',
                            default: 'set indicator brightness [VALUE]',
                            description: 'roboProStation set indicator brightness'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            VALUE: {
                                type: ArgumentType.UINT8_NUMBER,
                                menu: 'indicatorBrightness',
                                defaultValue: 3
                            }
                        }
                    },
                    {
                        opcode: 'setIndicatorDigitValue',
                        text: formatMessage({
                            id: 'roboPro.station.setIndicatorDigitValue',
                            default: 'set indicator digit [DIGIT] value [VALUE]',
                            description: 'roboProStation set indicator digit value'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            DIGIT: {
                                type: ArgumentType.UINT8_NUMBER,
                                menu: 'indicatorDigits',
                                defaultValue: 0
                            },
                            VALUE: {
                                type: ArgumentType.STRING,
                                menu: 'indicatorValues',
                                defaultValue: '0'
                            }
                        }
                    },
                    {
                        opcode: 'turnIndicatorSeparator',
                        text: formatMessage({
                            id: 'roboPro.station.turnIndicatorSeparator',
                            default: 'turn indicator separator (:) [VALUE]',
                            description: 'roboProStation set indicator separator on/off'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            VALUE: {
                                type: ArgumentType.STRING,
                                menu: 'onOff',
                                defaultValue: 'on'
                            }
                        }
                    },
                    {
                        opcode: 'turnIndicator',
                        text: formatMessage({
                            id: 'roboPro.station.turnIndicator',
                            default: 'turn indicator [VALUE]',
                            description: 'roboProStation turn indicator'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            VALUE: {
                                type: ArgumentType.STRING,
                                menu: 'onOff',
                                defaultValue: 'on'
                            }
                        }
                    },
                    {
                        opcode: 'setIndicatorValue',
                        text: formatMessage({
                            id: 'roboPro.station.setIndicatorValue',
                            default: 'set indicator value [VALUE]',
                            description: 'roboProStation set indicator value'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            VALUE: {
                                type: ArgumentType.STRING,
                                defaultValue: '0000'
                            }
                        }
                    }
                ],
                menus: {
                    analogPins: {
                        items: this.ANALOG_PINS_MENU
                    },
                    buttons: {
                        items: this.BUTTONS_MENU
                    },
                    colorLeds: {
                        items: this.COLOR_LEDS_MENU
                    },
                    digitalInputPins: {
                        items: this.DIGITAL_INPUT_PINS_MENU
                    },
                    digitalOutputPins: {
                        items: this.DIGITAL_OUTPUT_PINS_MENU
                    },
                    leds: {
                        acceptReporters: true,
                        items: this.LEDS_MENU
                    },
                    level: {
                        acceptReporters: true,
                        items: this.LEVEL_MENU
                    },
                    pwmPins: {
                        items: this.PWM_PINS_MENU
                    },
                    sensors: {
                        items: this.SENSORS_MENU
                    },
                    indicatorBrightness: {
                        items: this.INDICATOR_BRIGHTNESS_MENU
                    },
                    indicatorDigits: {
                        acceptReporters: true,
                        items: this.INDICATOR_DIGITS_MENU
                    },
                    indicatorValues: {
                        acceptReporters: true,
                        items: this.INDICATOR_VALUES_MENU
                    },
                    onOff: {
                        items: this.ON_OFF_MENU
                    }
                }
            },
            {
                id: 'serial',
                name: formatMessage({
                    id: 'arduinoUno.category.serial',
                    default: 'Serial',
                    description: 'The name of the arduino uno device serial category'
                }),
                color1: '#9966FF',
                color2: '#774DCB',
                color3: '#774DCB',

                blocks: [
                    {
                        opcode: 'serialBegin',
                        text: formatMessage({
                            id: 'arduinoUno.serial.serialBegin',
                            default: 'serial begin baudrate [VALUE]',
                            description: 'arduinoUno serial begin'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            VALUE: {
                                type: ArgumentType.STRING,
                                menu: 'baudrate',
                                defaultValue: Buadrate.B9600
                            }
                        },
                        programMode: [ProgramModeType.UPLOAD]
                    },
                    {
                        opcode: 'serialPrint',
                        text: formatMessage({
                            id: 'arduinoUno.serial.serialPrint',
                            default: 'serial print [VALUE] [EOL]',
                            description: 'arduinoUno serial print'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            VALUE: {
                                type: ArgumentType.STRING,
                                defaultValue: 'Hello OpenBlock'
                            },
                            EOL: {
                                type: ArgumentType.STRING,
                                menu: 'eol',
                                defaultValue: Eol.Warp
                            }
                        },
                        programMode: [ProgramModeType.UPLOAD]
                    },
                    {
                        opcode: 'serialAvailable',
                        text: formatMessage({
                            id: 'arduinoUno.serial.serialAvailable',
                            default: 'serial available data length',
                            description: 'arduinoUno serial available data length'
                        }),
                        blockType: BlockType.REPORTER,
                        disableMonitor: true,
                        programMode: [ProgramModeType.UPLOAD]
                    },
                    {
                        opcode: 'serialReadAByte',
                        text: formatMessage({
                            id: 'arduinoUno.serial.serialReadAByte',
                            default: 'serial read a byte',
                            description: 'arduinoUno serial read a byte'
                        }),
                        blockType: BlockType.REPORTER,
                        disableMonitor: true,
                        programMode: [ProgramModeType.UPLOAD]
                    }
                ],
                menus: {
                    baudrate: {
                        items: this.BAUDTATE_MENU
                    },
                    eol: {
                        items: this.EOL_MENU
                    }
                }
            },
        ];
    }

    /**
     * Turn LED strip on/off.
     * @param {object} args - the block's arguments.
     * @return {Promise} - a Promise that resolves on fixed write timeout to peripheral.
     */
    ledTurn (args) {
        let color = args.COLOR;
        const value = args.VALUE;
        if (this.strip) {
            if (Number.isInteger(color)) {
                color = Color.decimalToHex(color);
            }
            if (value === 'off') {
                this.strip.off();
            } else {
                this.strip.color(color);
                this.strip.show();
            }
        }
    }

    /**
     * Turn LED strip pixel on/off.
     * @param {object} args - the block's arguments.
     * @return {Promise} - a Promise that resolves on fixed write timeout to peripheral.
     */
    ledPixelTurn (args) {
        const ledIndex = args.LED_INDEX;
        let color = args.COLOR;
        const value = args.VALUE;
        if (this.strip) {
            if (Number.isInteger(color)) {
                color = Color.decimalToHex(color);
            }
            if (value === 'off') {
                color = LED_STRIP_BLACK_COLOR;
            }
            const stripPixel = this.strip.pixel(ledIndex);
            if (stripPixel) {
                stripPixel.color(color);
            }
            this.strip.show();
        }
    }

    /**
     * Turn color LED on/off.
     * @param {object} args - the block's arguments.
     * @return {Promise} - a Promise that resolves on fixed write timeout to peripheral.
     */
    colorLedTurn (args) {
        const ledPin = args.LED_PIN;
        const value = args.VALUE;
        log.info(`[colorLedTurn] ledPin: ${ledPin}, value: ${value}`);
        let level = Level.Low;
        if (value === 'on') {
            level = Level.High;
        }
        return this._peripheral.setDigitalOutput(ledPin, level);
    }

    setIndicatorBrightness (args) {
        const value = args.VALUE;
        if (this.display) {
            this.display.setBrightness(value);
        }
    }

    setIndicatorDigitValue (args) {
        const digit = args.DIGIT;
        const value = args.VALUE;
        if (this.display) {
            this.display.setDigit(digit, value);
        }
    }

    setIndicatorValue (args) {
        const value = args.VALUE;
        if (this.display) {
            this.display.show(value);
        }
    }

    turnIndicatorSeparator (args) {
        const value = args.VALUE;
        if (this.display) {
            if (value === 'on') {
                this.display.separatorOn();
            } else {
                this.display.separatorOff();
            }
        }
    }

    turnIndicator (args) {
        const value = args.VALUE;
        if (this.display) {
            if (value === 'on') {
                this.display.on();
            } else {
                this.display.off();
            }
        }
    }

    /**
     * Play a note.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     */
    playNoteForBeats (args, util) {
        if (util.stackTimerNeedsInit()) {
            let note = Cast.toNumber(args.NOTE);
            log.info(`[playNote] note: ${note}`);
            note = MathUtil.clamp(note,
                OpenBlockRoboProStationDevice.MIDI_NOTE_RANGE.min, OpenBlockRoboProStationDevice.MIDI_NOTE_RANGE.max);
            let beats = Cast.toNumber(args.BEATS);
            beats = this._clampBeats(beats);
            // If the duration is 0, do not play the note. In Scratch 2.0, "play drum for 0 beats" plays the drum,
            // but "play note for 0 beats" is silent.
            if (beats === 0) return;

            const durationSec = this._beatsToSec(beats);
            const duration = Math.max(0, 1000 * Cast.toNumber(durationSec));
            util.startStackTimer(duration);
            this._playNote(note, duration);
            util.yield();
        } else if (!util.stackTimerFinished()) {
            util.yield();
        }
    }

    /**
     * Read sensor.
     * @param {object} args - the block's arguments.
     * @return {Promise} - a Promise that resolves when read from peripheral.
     */
    readSensor (args) {
        let promise;
        switch (args.PIN) {
        case PinsMap.TempSensor:
            promise = this._peripheral.readDS18B20(args.PIN, 0);
            break;
        default:
            promise = this._peripheral.readAnalogPin(args.PIN);
            break;
        }
        return promise.then(value => this._peripheral.mapPinValue(args.PIN, value));
    }

    /**
     * Read button.
     * @param {object} args - the block's arguments.
     * @return {Promise} - true if read high level, false if read low level.
     */
    readButton(args) {
        return this._peripheral.readDigitalPin(args.PIN)
            .then(value => {
                if (value == 0) {
                    value = 1;
                } else {
                    value = 0;
                }
                return value;
            })
    }

    /**
     * Read analog pin.
     * @param {object} args - the block's arguments.
     * @return {Promise} - a Promise that resolves when read from peripheral.
     */
    readAnalogSensor (args) {
        return this._peripheral.readAnalogPin(args.PIN);
    }

    /**
     * Get the current tempo.
     * @return {number} - the current tempo, in beats per minute.
     */
    getTempo () {
        const stage = this.runtime.getTargetForStage();
        if (stage) {
            return stage.tempo;
        }
        return 60;
    }

    /**
     * Clamp a duration in beats to the allowed min and max duration.
     * @param  {number} beats - a duration in beats.
     * @return {number} - the clamped duration.
     * @private
     */
    _clampBeats (beats) {
        return MathUtil.clamp(beats, OpenBlockRoboProStationDevice.BEAT_RANGE.min,
            OpenBlockRoboProStationDevice.BEAT_RANGE.max);
    }

    /**
     * Convert a number of beats to a number of seconds, using the current tempo.
     * @param  {number} beats - number of beats to convert to secs.
     * @return {number} seconds - number of seconds `beats` will last.
     * @private
     */
    _beatsToSec (beats) {
        return (60 / this.getTempo()) * beats;
    }

    _playNote (note, duration) {
        const frequency = Math.max(0, 440 * (2 ** ((Cast.toNumber(note) - 69) / 12)));
        clearTimeout(this._playNoteTimeout);
        this._playNoteTimeout = setTimeout(() => {
            this._peripheral.stopToneOutput(PinsMap.Buzzer);
        }, duration);
        this._peripheral.setToneOutput(PinsMap.Buzzer, frequency);
    }
}

module.exports = OpenBlockRoboProStationDevice;
