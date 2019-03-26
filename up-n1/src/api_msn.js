// // 系统配置参数
// const config = require('config')
// // 路由相关
// const Router = require('koa-router')
// const router = new Router()
// // 工具相关
// const _ = require('lodash')
// // 日志相关
// const log = require('tracer').colorConsole({ level: config.log.level })
// // 持久层相关
// const MsnModel = require('./model/MsnModel')
// // const BizErr = require('./lib/Codes').BizErr
// /**
//  * 获取线路号列表
//  */
// router.post('/msnList', async function (ctx, next) {
//   let inparam = ctx.request.body
//   let token = ctx.tokenVerify
//   // 业务操作
//   const ret = await new MsnModel().getAllMsn()
//   if (ret && ret.Items.length > 0) {
//     let arr = new Array()
//     let flag = true
//     for (let i = 1; i < 1000; i++) {
//       flag = true
//       for (let item of ret.Items) {
//         if (i == parseInt(item.msn)) {
//           flag = false
//           break
//         }
//       }
//       if (flag) {
//         arr.push({ msn: i, status: 0 })
//       }
//     }
//     ret.Items = _.sortBy(ret.Items, [function (i) { return +i.msn }])
//     ret.Items.push(...arr)
//     if (inparam.msn || inparam.msn == 0) {
//       ret.Items = _.filter(ret.Items, i => +i.msn == +inparam.msn)
//     }
//     // 结果返回
//     ctx.body = { code: 0, payload: ret }
//   }
// })

// // /**
// //  * 检查线路号是否可用
// //  */
// // router.get('/check_msn/:msn', async function (ctx, next) {
// //   let params = ctx.params
// //   // 业务操作
// //   const checkRet = await new MsnModel().checkMSN(params)
// //   // 结果返回
// //   ctx.body = { code: 0, payload: { avalible: Boolean(checkRet) } }
// // })

// // /**
// //  * 随机线路号
// //  */
// // router.get('/msnRandom', async function (ctx, next) {
// //   // 业务操作
// //   const ret = await new MsnModel().getAllMsn()
// //   if (ret && ret.Items.length > 0) {
// //     // 所有线路号都被占用
// //     if (ret.Items.length >= 999) {
// //       throw BizErr.MsnFullError()
// //     }
// //     // 所有占用线路号组成数组
// //     let msnArr = new Array()
// //     for (let item of ret.Items) {
// //       msnArr.push(parseInt(item.msn))
// //     }
// //     // 随机生成线路号
// //     let randomMsn = randomNum(1, 999)
// //     // 判断随机线路号是否已被占用
// //     while (msnArr.indexOf(randomMsn) != -1) {
// //       randomMsn = randomNum(1, 999)
// //     }
// //     // 结果返回
// //     ctx.body = { code: 0, payload: randomMsn }
// //   }
// // })

// // ==================== 以下为内部方法 ====================

// // // 随机数
// // function randomNum(min, max) {
// //   let range = max - min
// //   let rand = Math.random()
// //   let num = min + Math.round(rand * range)
// //   return num
// // }

// module.exports = router