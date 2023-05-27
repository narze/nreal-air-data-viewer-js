import "./index.css"
import { setReportHandler, requestNrealAccess } from "./usb.ts"
import AHRS from "ahrs"
const madgwick = new AHRS({
  /*
   * The sample interval, in Hz.
   *
   * Default: 20
   */
  sampleInterval: 20,

  /*
   * Choose from the `Madgwick` or `Mahony` filter.
   *
   * Default: 'Madgwick'
   */
  algorithm: "Madgwick",

  /*
   * The filter noise value, smaller values have
   * smoother estimates, but have higher latency.
   * This only works for the `Madgwick` filter.
   *
   * Default: 0.4
   */
  beta: 0.4,

  /*
   * The filter noise values for the `Mahony` filter.
   */
  kp: 0.5, // Default: 0.5
  ki: 0, // Default: 0.0

  /*
   * When the AHRS algorithm runs for the first time and this value is
   * set to true, then initialisation is done.
   *
   * Default: false
   */
  doInitialisation: true,
})

Object.assign(window, {
  setReportHandler: setReportHandler,
  requestNrealAccess: requestNrealAccess,
})

function setLatestReport(text) {
  document.getElementById("overlay-content").innerText = text
}

function main() {
  let currentTime = performance.now()
  let previousTime = currentTime
  let readingCount = 0
  const NUM_READS_CALIBRATION = 2000

  let gyroAvg = {
    x: 0,
    y: 0,
    z: 0,
  }
  let gyroOffset = {
    x: 0,
    y: 0,
    z: 0,
  }

  let magnetoAvg = {
    x: 0,
    y: 0,
    z: 0,
  }
  let magnetoOffset = {
    x: 0,
    y: 0,
    z: 0,
  }

  let accelAvg = {
    x: 0,
    y: 0,
    z: 0,
  }
  let accelOffset = {
    x: 0,
    y: 0,
    z: 0,
  }

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

    const accelVector = getVector(
      acceleration_multiplier,
      acceleration_divisor,
      acceleration_x,
      acceleration_y,
      acceleration_z
    )

    const gyroVector = getVector(
      angular_multiplier,
      angular_divisor,
      angular_velocity_x,
      angular_velocity_y,
      angular_velocity_z
    )

    const magnetoVector = getVector(
      magnetic_multiplier.slice().reverse(),
      magnetic_divisor.slice().reverse(),
      magnetic_x,
      magnetic_y,
      magnetic_z
    )

    const sensorData = {
      gyroscope: gyroVector,
      accelerometer: accelVector,
      magnetometer: magnetoVector,
    }

    // console.log("sensorData", sensorData)

    currentTime = performance.now()
    const delta = currentTime - previousTime
    previousTime = currentTime
    // console.log({ delta })

    if (
      !isNaN(gyroVector.x) &&
      !isNaN(accelVector.x) &&
      !isNaN(magnetoVector.x)
    ) {
      if (readingCount <= NUM_READS_CALIBRATION) {
        gyroAvg.x += gyroVector.x
        gyroAvg.y += gyroVector.y
        gyroAvg.z += gyroVector.z

        magnetoAvg.x += magnetoVector.x
        magnetoAvg.y += magnetoVector.y
        magnetoAvg.z += magnetoVector.z

        accelAvg.x += accelVector.x
        accelAvg.y += accelVector.y
        accelAvg.z += accelVector.z
      } else if (readingCount == NUM_READS_CALIBRATION + 1) {
        gyroAvg.x /= NUM_READS_CALIBRATION
        gyroAvg.y /= NUM_READS_CALIBRATION
        gyroAvg.z /= NUM_READS_CALIBRATION

        magnetoAvg.x /= NUM_READS_CALIBRATION
        magnetoAvg.y /= NUM_READS_CALIBRATION
        magnetoAvg.z /= NUM_READS_CALIBRATION

        accelAvg.x /= NUM_READS_CALIBRATION
        accelAvg.y /= NUM_READS_CALIBRATION
        accelAvg.z /= NUM_READS_CALIBRATION

        gyroOffset = Object.assign({}, gyroAvg)
        magnetoOffset = Object.assign({}, magnetoAvg)
        accelOffset = Object.assign({}, accelAvg)

        console.log({ gyroOffset, magnetoOffset, accelOffset })
      }

      readingCount += 1

      if (readingCount == NUM_READS_CALIBRATION + 1) {
        console.log(
          "calibrated gyrovector",
          gyroVector.x - gyroOffset.x,
          gyroVector.y - gyroOffset.y,
          gyroVector.z - gyroOffset.z
        )
        console.log(
          "calibrated magnetoVector",
          magnetoVector.x - magnetoOffset.x,
          magnetoVector.y - magnetoOffset.y,
          magnetoVector.z - magnetoOffset.z
        )
      }

      lines.push(
        "accel (calibrated):" +
          [
            accelVector.x - accelOffset.x,
            accelVector.y - accelOffset.y,
            accelVector.z - accelOffset.z,
          ]
            .map((x) => x.toFixed(2))
            .join(", ")
      )

      lines.push(
        "gyro (calibrated):" +
          [
            gyroVector.x - gyroOffset.x,
            gyroVector.y - gyroOffset.y,
            gyroVector.z - gyroOffset.z,
          ]
            .map((x) => x.toFixed(2))
            .join(", ")
      )

      lines.push(
        "magneto (calibrated):" +
          [
            magnetoVector.x - magnetoOffset.x,
            magnetoVector.y - magnetoOffset.y,
            magnetoVector.z - magnetoOffset.z,
          ]
            .map((x) => x.toFixed(2))
            .join(", ")
      )

      madgwick.update(
        -((gyroVector.y - gyroOffset.y) / 180) * Math.PI, // Convert to radians
        ((gyroVector.x - gyroOffset.x) / 180) * Math.PI, // Convert to radians
        -((gyroVector.z - gyroOffset.z) / 180) * Math.PI, // Convert to radians
        accelVector.x - accelOffset.x,
        accelVector.y - accelOffset.y,
        accelVector.z - accelOffset.z,
        magnetoVector.x - magnetoOffset.x,
        magnetoVector.y - magnetoOffset.y,
        magnetoVector.z - magnetoOffset.z,
        // currentTime / 1000
        delta / 1000
      )
    }

    const vector = madgwick.toVector()
    const quaternion = madgwick.getQuaternion()
    const euler = madgwick.getEulerAngles()
    // console.log({ vector })

    // console.log(accelVector)
    if (!isNaN(euler.heading)) {
      // console.log("euler.heading is not NaN", euler)

      lines.push("[AHRS]")
      lines.push(
        "Euler: " +
          [euler.pitch, euler.heading, euler.roll]
            .map((x) => x.toFixed(2))
            .join(", ")
      )
      lines.push(
        "Vector: " +
          [vector.x, vector.y, vector.z, vector.angle]
            .map((x) => x.toFixed(2))
            .join(", ")
      )
      lines.push(
        "quaternion:" +
          [quaternion.w, quaternion.x, quaternion.y, quaternion.z]
            .map((x) => x.toFixed(2))
            .join(", ")
      )

      const event = new CustomEvent("xreal-data", {
        detail: { euler, vector, accelVector },
      })

      // Emit the event with data
      window.dispatchEvent(event)
    } else {
      // console.log("euler.heading is NaN", { euler, sensorData })
    }

    setLatestReport(lines.join("\n"))
  })
}

AFRAME.registerComponent("xreal-controls", {
  dependencies: ["rotation"],
  init: function () {
    this.XRealData = {
      euler: { heading: 0, pitch: 0, roll: 0 },
      vector: { x: 0, y: 0, z: 0 },
      accelVector: { x: 0, y: 0, z: 0 },
    }
  },
  update: function () {
    window.addEventListener("xreal-data", this.onXRealData.bind(this))
  },
  onXRealData: function ({ detail }) {
    this.XRealData = detail
    // console.log("onXRealData", this.XRealData)
  },
  tick: function () {
    // this.el.object3D.rotation.x = this.XRealData.vector.x
    // this.el.object3D.rotation.y = this.XRealData.vector.y
    // this.el.object3D.rotation.z = this.XRealData.vector.z

    // Working, but will always force the object center of the screen
    this.el.object3D.rotation.x = this.XRealData.euler.pitch
    this.el.object3D.rotation.y = this.XRealData.euler.heading
    this.el.object3D.rotation.z = this.XRealData.euler.roll

    // Reset
    // this.el.object3D.rotation.x = 0
    // this.el.object3D.rotation.y = 0
    // this.el.object3D.rotation.z = 0

    // this.el.object3D.rotation.x = -this.XRealData.accelVector.y
    // this.el.object3D.rotation.y = -this.XRealData.euler.heading
    // this.el.object3D.rotation.z = -this.XRealData.accelVector.x

    // tick: function () {
    //   this.el.object3D.rotation.x = -this.XRealData.y
    //   // this.el.object3D.rotation.y = this.XRealData.z // TODO
    //   this.el.object3D.rotation.z = -this.XRealData.x
    // }
  },
})

main()
