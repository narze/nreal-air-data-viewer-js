import "./index.css"
import { setReportHandler, requestNrealAccess } from "./usb.ts"

Object.assign(window, {
  setReportHandler: setReportHandler,
  requestNrealAccess: requestNrealAccess,
})
