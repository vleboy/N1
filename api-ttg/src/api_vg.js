// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const parseString = require('xml2js').parseString
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}

/**
 * VG 游戏链接
 * gameId 游戏大类
 * sid    游戏小类
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/vg/gameurl/:gameId/:sid/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
})

/**
 * VG 游戏链接
 * userId 玩家ID
 * type   上分或下分
 * id     流水ID
 * betId  关联交易号
 */
router.post('/vg/transaction', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    let inparam = ctx.request.body
    let player = await new PlayerModel().getPlayerById(inparam.userId)
    if (inparam.type == 'BET') {
        inparam.billType = 3
        inparam.amount = player.balance * -1
    } else {
        inparam.billType = 4
        inparam.amount = Math.abs(inparam.amount)
    }
    inparam.gameType = config.vg.gameType
    inparam.businessKey = `BVG_${inparam.username}_${inparam.transactionId}`
    inparam.anotherGameData = JSON.stringify(inparam)
    inparam.txnidTemp = `${inparam.username}_${inparam.type}_${inparam.transactionId}`

    let amtAfter = await new PlayerModel().updatebalance(player, inparam)

    if (amtAfter == 'err') {
        ctx.body = { code: -1, msg: 'error' }
    } else {
        ctx.body = { code: 0, msg: 'success', balance: amtAfter }
    }
})
