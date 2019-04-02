// // 系统配置参数
// const config = require('config')
// // 路由相关
// const Router = require('koa-router')
// const router = new Router()
// // 工具相关
// const _ = require('lodash')
// const axios = require('axios')
// const moment = require('moment')
// const crypto = require('crypto')
// const qs = require('querystring')
// // 日志相关
// const log = require('tracer').colorConsole({ level: config.log.level })
// // 持久层相关
// const PlayerModel = require('./model/PlayerModel')
// const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
// const LogModel = require('./model/LogModel')

// /**
//  * 开元棋牌玩家登录
//  * @param account 玩家账号
//  */
// router.get('/ky/gameurl/:gameId/:sid/:userId/:token', async function (ctx, next) {
//     let time = new moment().utcOffset(8)
//     let inparam = ctx.params
//     // 请求N1服务器是否允许玩家进入游戏
//     const nares = await axios.post(config.na.joingameurl, {
//         userId: inparam.userId,
//         gameId: inparam.gameId,
//         sid: inparam.sid,
//         token: inparam.token
//     })
//     if (nares.data.code != 0) {
//         ctx.body = { code: nares.data.code, msg: nares.data.msg }
//         return
//     }
//     let account = inparam.userId                                                                //玩家账号
//     //
//     //获取玩家的余额
//     const player = await new PlayerModel().getPlayerById(account)
//     let money = player.balance                                                                  //玩家的余额
//     let orderId = inparam.orderId || config.ky.agent + time.format("YYYYMMDDHHmmss") + account  //流水号
//     let ip = ctx.request.ip                                                                     //玩家IP
//     let lineCode = inparam.lineCode || 1                                                        //代理下面的站点标识
//     let param = `s=0&account=${account}&money=${money}&lineCode=${lineCode}&ip=${ip}&orderid=${orderId}&KindId=0`
//     let url = getURL(0, param)
//     let response = await axios.get(url, { timeout: 100 * 1000 })
//     if (response.data.d.code == 0) {
//         //如果操作成功则（模拟）下注扣除玩家的上分（余额）
//         let updateParams = {}
//         updateParams.billType = 3
//         updateParams.amt = parseFloat(money) * -1
//         updateParams.gameType = config.ky.gameType
//         updateParams.businessKey = `BKY_${account}_${orderId}`                        // 设置局号
//         updateParams.userId = player.userId
//         updateParams.userName = player.userName
//         let amtAfter = await new PlayerModel().updatebalance(player, updateParams)
//         if (amtAfter == 'err') {
//             ctx.body = { code: 404, message: "发生错误了" }
//         } else {
//             ctx.redirect(response.data.d.url)
//         }
//     } else {
//         ctx.body = { code: response.data.d.code, message: "上分失败", err: response.data.d }
//     }
// })

// /**
//  * 查询/踢玩家下线接口
//  * @param s 操作类型 1：查询玩家可下分余额 5：查询玩家是否在线 7：查询游戏总余额 8：根据玩家账号提玩家下线
//  * @param account 玩家账号
//  */
// router.get('/ky/:s/:account', async function (ctx, next) {
//     let time = new moment().utcOffset(8)
//     //获取入参
//     let inparam = ctx.params
//     let account = inparam.account                                                               //会员账号
//     let s = inparam.s                                                                           //操作子类型
//     let param = `s=${s}&account=${account}`
//     //获取请求url
//     let url = getURL(parseInt(s), param)
//     let response = await axios.get(url, { timeout: 100 * 1000 })
//     //根据操作类型做相应处理
//     if (response.data.d.code == 0) {
//         switch (parseInt(s)) {
//             case 1://查询玩家可下分余额
//                 ctx.body = { code: 0, message: "success", money: response.data.d.money }
//                 break;
//             case 5://查询玩家是否在线
//                 ctx.body = { code: 0, message: "success", status: response.data.d.status }
//                 break;
//             case 7://查询游戏总余额
//                 ctx.body = { code: 0, message: "success", totalMoney: response.data.d.totalMoney, freeMoney: response.data.d.freeMoney }
//                 break;
//             case 8://根据玩家账号提玩家下线
//                 //如果是踢玩家下线那么应该做些什么处理？？？？
//                 //通知服务器，查询可下分余额并返奖等。。。。
//                 //未完！！！
//                 ctx.body = { code: 0, message: "success" }
//                 break;
//         }
//     } else {
//         ctx.body = { code: -1, msg: '操作失败', err: response.data }
//     }
// })
// /**
//  * 上下分订单状态接口
//  * @param orderId 流水号
//  */
// router.get('/ky/:orderId', async function (ctx, next) {
//     let time = new moment().utcOffset(8)
//     //获取入参
//     let inparam = ctx.params
//     let orderId = inparam.orderId                                                               //流水号                                           
//     let param = `s=4&orderid=${orderId}`
//     //获取请求url
//     let url = getURL(parseInt(s), param)
//     let response = await axios.get(url, { timeout: 100 * 1000 })
//     //根据操作类型做相应处理
//     if (response.data.d.code == 0) {
//         ctx.body = { code: 0, message: "success", status: response.data.d.status }
//     } else {
//         ctx.body = { code: -1, msg: '操作失败', err: response.data }
//     }
// })
// /**
//  * 上分/下分
//  */
// router.post('/ky/handleBalance', async function (ctx, next) {
//     let time = new moment().utcOffset(8)
//     //获取入参
//     let inparam = ctx.request.body
//     let account = inparam.account                                                               //会员账号
//     let money = inparam.money                                                                   //金额
//     let orderId = inparam.orderId || config.ky.agent + time.format("YYYYMMDDHHmmss") + account  //流水号
//     let s = inparam.s                                                                           //操作子类型
//     let ip = ctx.request.ip                                                                     //玩家IP
//     let param = ""
//     if (parseInt(s) == 2) {//上分
//         //获取玩家余额是否够上分
//         const player = await new PlayerModel().getPlayerById(account)
//         //（模拟）下注扣除玩家的上分（余额）
//         let updateParams = {}
//         updateParams.billType = 3
//         updateParams.amt = parseFloat(inparam.amount) * -1
//         updateParams.gameType = config.ky.gameType
//         updateParams.businessKey = `BKY_${account}_${orderId}`                        // 设置局号
//         updateParams.userId = player.userId
//         updateParams.userName = player.userName
//         let amtAfter = await new PlayerModel().updatebalance(player, updateParams)
//         if (amtAfter == 'err') {
//             ctx.body = { code: 404, message: "余额不足或系统内部错误" }
//             return
//         }
//         param = `s=${s}&account=${account}&orderid=${orderId}&money=${money}&ip=${ip}`
//     } else if (parseInt(s) == 3) {//下分
//         param = `s=${s}&account=${account}&orderid=${orderId}&money=${money}&ip=${ip}`
//     }
//     //获取请求url
//     let url = getURL(parseInt(s), param)
//     let response = await axios.get(url, { timeout: 100 * 1000 })
//     //根据操作类型做相应处理
//     if (response.data.d.code == 0) {
//         switch (parseInt(s)) {
//             case 2://上分
//                 ctx.body = { code: 0, message: "success", money: response.data.d.money }
//                 break;
//             case 3://下分
//                 //下分成功需要更新余额 相当于返奖

//                 ctx.body = { code: 0, message: "success", money: response.data.d.money }
//                 break;
//         }
//     } else {
//         ctx.body = { code: -1, msg: '操作失败', err: response.data }
//     }
// })
// /**
//  * 获取游戏注单（拉去时间最大不能超过60分钟）
//  */
// router.post('/ky/getBillDetail', async function (ctx, next) {
//     let time = new moment().utcOffset(8)
//     //获取入参
//     let inparam = ctx.request.body
//     let startTime = inparam.startTime                                                           //开始时间
//     let endTime = inparam.endTime                                                               //结束时间                                       
//     let param = param = `s=6&startTime=${startTime}&endTime=${endTime}`
//     //获取请求url
//     let url = getURL(6, param)
//     let response = await axios.get(url, { timeout: 100 * 1000 })
//     //根据操作类型做相应处理
//     if (response.data.d.code == 0) {

//     } else {
//         ctx.body = { code: -1, msg: '操作失败', err: response.data }
//     }
// })
// /**
//  * 玩家下线（提供给ky的回调通知）
//  */
// router.post('/ky/logout', async function (ctx, next) {
//     //获取入参
//     let inparam = ctx.request.body
//     let agent = inparam.agent
//     let account = inparam.account
//     let money = inparam.money
//     //模拟返奖更新余额
//     const player = await new PlayerModel().getPlayerById(account)
    
// })


// /**
//  * 玩家登出
//  * @param {*} userId 玩家ID
//  * @param {*} sid    具体游戏ID
//  */
// router.get('/ky/logout/:userId/:sid', async function (ctx, next) {
//     let userId = ctx.params.userId
//     let sid = ctx.params.sid
//     log.info(`准备退出玩家【${userId}】`)
//     // 绑定签名
//     const data = {
//         gameId: sid,
//         userId: userId,
//         timestamp: Date.now(),
//         exit: 1,
//         records: [],
//         zlib: 1
//     }
//     NASign.bindSign(config.ky.gameKey, ['gameId', 'timestamp', 'records'], data)
//     // 登出NA平台
//     log.info(`请求NA平台【POST】${config.na.settlementurl}`)
//     log.info('请求NA平台【参数】' + JSON.stringify(data))
//     const res = await axios.post(config.na.settlementurl, data)
//     if (res.data.code != 0) {
//         res.data.errUserId = userId
//         ctx.body = res.data
//         log.error(res.data)
//     }
//     ctx.body = { code: 0, msg: '玩家退出成功' }
// })


// /****** 开元棋牌的内部方法*/
// //1,组装获取请求的url
// function getURL(s, param) {
//     let time = new moment().utcOffset(8)
//     let timestamp = time.unix() * 1000
//     let url = s != 6 ? config.ky.apiUrl : config.ky.recordUrl
//     url = url + "?" + qs.stringify({
//         agent: config.ky.agent,
//         timestamp: timestamp,
//         param: desEncode(config.ky.desKey, param),
//         key: crypto.createHash('md5').update(config.ky.agent + timestamp.toString() + config.ky.md5key).digest('hex'),
//     })
//     return url
// }
// //2,DES解密
// function desDecode(desKey, data) {
//     var cipherChunks = [];
//     var decipher = crypto.createDecipheriv('aes-128-ecb', desKey, '');
//     decipher.setAutoPadding(true);
//     cipherChunks.push(decipher.update(data, 'base64', 'utf8'));
//     cipherChunks.push(decipher.final('utf8'));
//     return cipherChunks.join('');
// }
// //3,DES加密
// function desEncode(desKey, data) {
//     var cipherChunks = [];
//     var cipher = crypto.createCipheriv('aes-128-ecb', desKey, '');
//     cipher.setAutoPadding(true);
//     cipherChunks.push(cipher.update(data, 'utf8', 'base64'));
//     cipherChunks.push(cipher.final('base64'));

//     return cipherChunks.join('');
// }

// module.exports = router