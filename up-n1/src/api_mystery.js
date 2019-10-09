// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
const UserModel = require('./model/UserModel')
const Model = require('./lib/Model').Model
const GameTypeEnum = require('./lib/Consts').GameTypeEnum

/**
 * 神秘大奖列表（新）
 */
router.post('/mysteryList', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 商户只能看自己的
    if (Model.isMerchant(token)) {
        if (inparam.query) {
            inparam.query.sn = token.sn
        } else {
            inparam.query = {}
            inparam.query.sn = token.sn
        }
    }
    // 参数处理
    if (!inparam.betTime) {
        inparam.betTime = [0, Date.now()]
    }
    // 条件筛选
    if (inparam.query) {
        if (!_.isEmpty(inparam.query.sn)) {
            let userInfo = await new UserModel().getUserBySN(inparam.query.sn)
            if (_.isEmpty(userInfo)) {
                return ctx.body = { code: 0, payload: [] }
            }
            inparam.query.parentId = userInfo.userId
            delete inparam.query.sn
        }
    }
    // 查询
    let retList = await new HeraGameRecordModel().getMysteryList(inparam)
    let parentGroupList = _.groupBy(retList, 'parentId')
    let promiseArr = []
    for (let userId in parentGroupList) {
        let p = new Promise(async (resolve, reject) => {
            let mysteryList = []
            let userInfo = await new UserModel().queryUserById(userId)
            for (let item of parentGroupList[userId]) {
                item.displayName = userInfo.displayName
                item.sn = userInfo.sn
                item.displayId = userInfo.displayId
                item.parent = userInfo.parent
                item.winAmount = JSON.parse(item.record.gameDetail).totalGold
                item.gameTypeName = (GameTypeEnum[item.gameType.toString()] || { name: "未知" }).name
                item.initBonus = JSON.parse(item.record.gameDetail).secretBonusData.initBonus
                item.robotBet = JSON.parse(item.record.gameDetail).secretBonusData.robotBet
                delete item.record
                mysteryList.push(item)
            }
            resolve(mysteryList)
        })
        promiseArr.push(p)
    }
    let returnList = await Promise.all(promiseArr)
    let payload = _.orderBy(_.flattenDepth(returnList), ['betTime'], ['desc'])
    // 线路商筛选其下属所有记录返回
    if (Model.isManager(token)) {
        payload = payload.filter(o => o.parent == token.userId)
    }
    // 返回结果
    ctx.body = { code: 0, payload }
})

module.exports = router