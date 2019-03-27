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
    // 权限校验
    if (!Model.isPlatformAdmin(token)) {
        throw { "code": -1, "msg": "权限不足" }
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
            if (userInfo.role != '1000') { //如果是代理的就剔除
                for (let item of parentGroupList[userId]) {
                    item.displayName = userInfo.displayName
                    item.sn = userInfo.sn
                    item.displayId = userInfo.displayId
                    item.winAmount = JSON.parse(item.record.gameDetail).totalGold
                    item.gameTypeName = (GameTypeEnum[item.gameType.toString()] || { name: "未知" }).name
                    delete item.record
                    mysteryList.push(item)
                }
            }
            resolve(mysteryList)
        })
        promiseArr.push(p)
    }
    let returnList = await Promise.all(promiseArr)
    // 返回结果
    ctx.body = { code: 0, payload: _.orderBy(_.flattenDepth(returnList), ['betTime'], ['desc']) }
})

module.exports = router