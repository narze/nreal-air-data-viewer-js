import "./index.css"
import { setReportHandler, requestNrealAccess } from "./usb.ts"

Object.assign(window, {
  setReportHandler: setReportHandler,
  requestNrealAccess: requestNrealAccess,
})

function setLatestReport(text) {
  document.getElementById("overlay-content").innerText = text
}

function main() {
  console.log("main script loaded")

  window.setReportHandler((index, data) => {
    void index
    if (data.length !== 64) return
    const lines = []
    let offset = 0
    const format = (data) => {
      return Array.from(data)
        .map((a) => `00${a.toString(16)}`.slice(-2))
        .join(" ")
    }
    const extract = (length) => {
      const slice = data.slice(offset, offset + length)
      offset += length
      return slice
    }
    const extractAndPrint = (text, length) => {
      const slice = extract(length)
      lines.push(text + ": " + format(slice))
      return slice
    }

    extractAndPrint("signature", 2)
    extractAndPrint("temperature", 2)
    extractAndPrint("timestamp", 8)

    const getVector = (multiplier, divisor, x, y, z) => {
      const signed = (x) => (x & 0x80 ? x - 0x100 : x)
      const m = signed(multiplier[1]) * 256 + signed(multiplier[0])
      const d =
        signed(divisor[3]) * 256 * 256 * 256 +
        divisor[2] * 256 * 256 +
        divisor[1] * 256 +
        divisor[0]
      const convert = (a) => {
        return a.length === 2
          ? (((signed(a[1]) ^ 0x80) * 256 + a[0]) * m) / d
          : ((signed(a[2]) * 256 * 256 + a[1] * 256 + a[0]) * m) / d
      }
      return {
        x: convert(x),
        y: convert(y),
        z: convert(z),
      }
    }
    const printVector = (name, vector) => {
      lines.push(
        `${name}: (${[
          `${vector.x.toFixed(3).padStart(10)}`,
          `${vector.y.toFixed(3).padStart(10)}`,
          `${vector.z.toFixed(3).padStart(10)}`,
        ].join(", ")})`
      )
    }

    const angular_multiplier = extractAndPrint("angular_multiplier", 2)
    const angular_divisor = extractAndPrint("angular_divisor", 4)
    const angular_velocity_x = extractAndPrint("angular_velocity_x", 3)
    const angular_velocity_y = extractAndPrint("angular_velocity_y", 3)
    const angular_velocity_z = extractAndPrint("angular_velocity_z", 3)
    printVector(
      "angular_velocity",
      getVector(
        angular_multiplier,
        angular_divisor,
        angular_velocity_x,
        angular_velocity_y,
        angular_velocity_z
      )
    )

    const acceleration_multiplier = extractAndPrint(
      "acceleration_multiplier",
      2
    )
    const acceleration_divisor = extractAndPrint("acceleration_divisor", 4)
    const acceleration_x = extractAndPrint("acceleration_x", 3)
    const acceleration_y = extractAndPrint("acceleration_y", 3)
    const acceleration_z = extractAndPrint("acceleration_z", 3)
    printVector(
      "acceleration",
      getVector(
        acceleration_multiplier,
        acceleration_divisor,
        acceleration_x,
        acceleration_y,
        acceleration_z
      )
    )

    const magnetic_multiplier = extractAndPrint("magnetic_multiplier", 2)
    const magnetic_divisor = extractAndPrint("magnetic_divisor", 4)
    const magnetic_x = extractAndPrint("magnetic_x", 2)
    const magnetic_y = extractAndPrint("magnetic_y", 2)
    const magnetic_z = extractAndPrint("magnetic_z", 2)
    printVector(
      "magnetic",
      getVector(
        magnetic_multiplier.slice().reverse(),
        magnetic_divisor.slice().reverse(),
        magnetic_x,
        magnetic_y,
        magnetic_z
      )
    )

    setLatestReport(lines.join("\n"))

    const accelVector = getVector(
      acceleration_multiplier,
      acceleration_divisor,
      acceleration_x,
      acceleration_y,
      acceleration_z
    )

    // console.log(accelVector)
    const event = new CustomEvent("xreal-data", { detail: accelVector })

    // Emit the event with data
    window.dispatchEvent(event)
  })
}

AFRAME.registerComponent("xreal-controls", {
  dependencies: ["rotation"],
  init: function () {
    this.XRealData = { x: 0, y: 0, z: 0 }
  },
  update: function () {
    window.addEventListener("xreal-data", this.onXRealData.bind(this))
  },
  onXRealData: function ({ detail }) {
    this.XRealData = detail
  },
  tick: function () {
    this.el.object3D.rotation.x = -this.XRealData.y
    // this.el.object3D.rotation.y = this.XRealData.z // TODO
    this.el.object3D.rotation.z = -this.XRealData.x
  },
})

main()
