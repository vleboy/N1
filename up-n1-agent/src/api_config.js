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
const LogModel = require('./model/LogModel')
const UserModel = require('./model/UserModel')
const ConfigModel = require('./model/ConfigModel')
const ConfigMultModel = require('./model/ConfigMultModel')
const ConfigCheck = require('./biz/ConfigCheck')
const RoleCodeEnum = require('./lib/UserConsts').RoleCodeEnum

// 创建配置
router.post('/configNew', async function (ctx, next) {
    let inparam = ctx.request.body
    //检查参数是否合法
    if (inparam.code == 'mystery') {
        new ConfigCheck().checkMystery(inparam)
    } else {
        throw { 'code': -1, 'msg': '配置编码错误', 'params': ['code'] }
    }
    // 业务操作
    const ret = await new ConfigModel().add(inparam)
    // 操作日志记录
    inparam.operateAction = '更新配置:' + inparam.code
    inparam.operateToken = ctx.tokenVerify
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 单个配置
router.post('/configOne', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new ConfigModel().getOne(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 创建多级配置
router.post('/configMultNew', async function (ctx, next) {
    let inparam = ctx.request.body
    //检查参数是否合法
    if (inparam.code == 'videoconfig') {
        new ConfigCheck().checkVideoConfig(inparam)
    } else if (inparam.code == 'lobbyconfig') {
        new ConfigCheck().checkLobbyConfig(inparam)
    } else {
        throw { 'code': -1, 'msg': '配置编码错误', 'params': ['code'] }
    }
    // 业务操作
    const ret = await new ConfigMultModel().add(inparam)
    // 操作日志记录
    inparam.operateAction = '更新多级配置:' + inparam.code
    inparam.operateToken = ctx.tokenVerify
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 单个多级配置
router.post('/configMultOne', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new ConfigMultModel().getOne(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 多级配置列表
router.post('/configMultList', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    let ret = await new ConfigMultModel().page(inparam)
    // 如果是电子游戏配置，需要所有商户
    if (inparam.code == 'videoconfig') {
        inparam.role = RoleCodeEnum.Merchant
        const usersRet = await new UserModel().queryByRole(inparam)
        for (let user of usersRet) {
            const itemIndex = _.findIndex(ret, ['businessKey', user.displayId.toString()])
            if (itemIndex >= 0) {
                user.content = ret[itemIndex]
            }
        }
        ret = usersRet
    }
    if (inparam.code == 'lobbyconfig') {
        // 按照顺序排序
        ret = _.sortBy(ret, 'sort')
    }
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})
/**
 * 删除配置中某一项
 */
router.post('/configMultDel', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    let ret = await new ConfigMultModel().delConfig(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

module.exports = router