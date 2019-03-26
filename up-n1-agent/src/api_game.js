// // 系统配置参数
// const config = require('config')
// // 路由相关
// const Router = require('koa-router')
// const router = new Router()
// // 工具相关
// const _ = require('lodash')
// const axios = require('axios')
// // 日志相关
// const log = require('tracer').colorConsole({ level: config.log.level })
// const RoleCodeEnum = require('./lib/UserConsts').RoleCodeEnum
// const UserModel = require('./model/UserModel')

// // 获取游戏大类
// router.post('/gameBigType', async function (ctx, next) {
//     let inparam = ctx.request.body
//     // 业务操作
//     const res = await axios.post(`https://${config.env.GAME_CENTER}/externBigType`, inparam, {
//         headers: { 'Authorization': ctx.header.authorization }
//     })
//     if (inparam.companyIden == '-1') {
//         if (process.env.NODE_ENV == 'agent-n2') {
//             let newArr = res.data.payload.filter(i => +i.code < 100000)
//             ctx.body = { code: 0, payload: newArr }
//         } else {
//             ctx.body = { code: 0, payload: res.data.payload }
//         }
//     } else {
//         if (inparam.userId) {
//             let gameTypeArr = []
//             let typeArr = res.data.payload
//             let GameTypeEnum = res.data.gameTypeEnum
//             //如果有userId过滤掉没有的游戏大类
//             let userRet = await new UserModel().queryUserById(inparam.userId)
//             let newTypeArr = []
//             for (let i = 0; i < userRet.gameList.length; i++) {
//                 if (_.includes(typeArr, userRet.gameList[i].code)) {
//                     newTypeArr.push(userRet.gameList[i].code)
//                 }
//             }
//             for (let item of newTypeArr) {
//                 gameTypeArr.push(GameTypeEnum[item])
//             }
//             ctx.body = { code: 0, payload: gameTypeArr }
//         } else {
//             ctx.body = { code: 0, payload: res.data.payload }
//         }
//     }
// })

// // 选择公司
// router.post('/companySelect', async function (ctx, next) {
//     let inparam = ctx.request.body
//     // 业务操作
//     if (!inparam.parent || inparam.parent == '01') {
//         const res = await axios.post(`https://${config.env.GAME_CENTER}/companySelect`, inparam, {
//             headers: { 'Authorization': ctx.header.authorization }
//         })
//         if (process.env.NODE_ENV == 'agent-n2') {
//             let newArr = res.data.payload.filter(i => i.company == 'NA')
//             ctx.body = { code: 0, payload: newArr }
//         } else {
//             ctx.body = { code: 0, payload: res.data.payload }
//         }
//     } else {
//         // 上级游戏类别
//         const ret = await new UserModel().queryUserById(inparam.parent)
//         ret.gameList = ret.gameList || []
//         // 刷新最新游戏类型内容
//         let newGameList = []
//         for (let item of ret.gameList) {
//             newGameList.push({ company: item.company, companyName: item.companyName })
//         }
//         newGameList = _.uniqWith(newGameList, _.isEqual)
//         let gameTypeArr = []
//         for (let item of newGameList) {
//             gameTypeArr.push({ company: item.company, companyName: item.companyName })
//         }
//         ctx.body = { code: 0, payload: gameTypeArr }
//     }
// })
// module.exports = router