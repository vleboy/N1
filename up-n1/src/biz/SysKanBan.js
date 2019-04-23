// const Model = require('../lib/UserConsts').Model
// const Util = require("../lib/athena").Util
// const RegEnum = require("../lib/athena").RegEnum
// class SysKanBan {
//     /**
//      * 系统看板数据统计
//      */
//     checkOverview(inparam) {
//         let [checkAttError, errorParams] = Util.checkProperties([
//             { name: "type", type: "S" }
//         ], inparam)

//         if (checkAttError) {
//             Object.assign(checkAttError, { params: errorParams })
//             throw checkAttError
//         }
//         // 数据类型处理
//         inparam.type = +inparam.type

//     }
//     //平台消耗点数
//     checkConsume(inparam) {
//         let [checkAttError, errorParams] = Util.checkProperties([
//             { name: "startTime", type: "N" },
//             { name: "endTime", type: "N" }
//         ], inparam)

//         if (checkAttError) {
//             Object.assign(checkAttError, { params: errorParams })
//             throw checkAttError
//         }
//         // 数据类型处理
//         inparam.startTime = +inparam.startTime
//         inparam.endTime = +inparam.endTime
//     }
//     //玩家注册折线图
//     checkPlayer(inparam) {
//         let [checkAttError, errorParams] = Util.checkProperties([
//             { name: "startTime", type: "N" },
//             { name: "endTime", type: "N" }
//         ], inparam)

//         if (checkAttError) {
//             Object.assign(checkAttError, { params: errorParams })
//             throw checkAttError
//         }
//         // 数据类型处理
//         inparam.startTime = +inparam.startTime
//         inparam.endTime = +inparam.endTime
//     }

// }

// module.exports = SysKanBan