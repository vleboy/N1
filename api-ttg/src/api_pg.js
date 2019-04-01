// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const jwt = require('jsonwebtoken')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')

/**
 * PG PC版本游戏链接
 * gameName 游戏名称
 * gameId 游戏大类
 * sid    游戏小类
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/pg/gameurl/:gameName/:gameId/:sid/:userId/:token', async function (ctx, next) {
    let inparam = ctx.params
    let finalUrl = ''
    // 试玩
    if (inparam.userId == 0) {
        finalUrl = `${config.pg.launchUrl}/${inparam.gameName}/index.html?&language=zh&bet_type=2&operator_token=${config.pg.operator_token}&from=${encodeURIComponent(ctx.request.query.homeurl || '')}&real_url=${encodeURIComponent(ctx.request.query.homeurl || '')}`
    }
    // 正式
    else {
        // 请求N1服务器是否允许玩家进入游戏
        const nares = await axios.post(config.na.joingameurl, {
            userId: inparam.userId,
            gameId: inparam.gameId,
            sid: inparam.sid,
            token: inparam.token
        })
        if (nares.data.code != 0) {
            log.error(nares.data)
            return ctx.body = { code: nares.data.code, msg: nares.data.msg }
        }
        //生成玩家token用户pg校验，一天有效期
        let pgToken = jwt.sign({ userId: inparam.userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }, config.pg.gameKey)
        finalUrl = `${config.pg.launchUrl}/${inparam.gameName}/index.html?&language=zh&bet_type=1&operator_token=${config.pg.operator_token}&operator_player_session=${pgToken}&from=${encodeURIComponent(ctx.request.query.homeurl || '')}`
    }
    log.info(`PG最终游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

// 登录认证
router.post('/pg/VerifySession', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    if (inparam.operator_token != config.pg.operator_token || inparam.secret_key != config.pg.secret_key) {
        return ctx.body = { data: null, error: { code: 1034, message: '无效的请求' } }
    }
    //验证玩家
    let loginInfo = {}
    try {
        loginInfo = jwt.verify(inparam.operator_player_session, config.pg.gameKey)
    } catch (error) {
        return ctx.body = { data: null, error: { code: 1034, message: '无效的请求' } }
    }
    //获取玩家
    const player = await new PlayerModel().getPlayerById(loginInfo.userId)
    //返回结果
    ctx.body = { data: { player_name: player.userId, nickname: player.userId, currency: 'CNY', reminder_time: Date.now() }, error: null }
})

// 获取玩家余额
router.post('/pg/Cash/Get', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    if (inparam.operator_token != config.pg.operator_token || inparam.secret_key != config.pg.secret_key) {
        return ctx.body = { data: null, error: { code: 1034, message: '无效的请求' } }
    }
    //验证参数
    let loginInfo = {}
    try {
        loginInfo = jwt.verify(inparam.operator_player_session, config.pg.gameKey)
    } catch (error) {
        return ctx.body = { data: null, error: { code: 1034, message: '无效的请求' } }
    }
    //验证玩家
    const player = await new PlayerModel().getPlayerById(loginInfo.userId)
    //返回结果
    ctx.body = { data: { currency_code: 'CNY', balance_amount: player.balance, updated_time: Date.now() }, error: null }
})

// 下注
router.post('/pg/Cash/TransferOut', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    if (inparam.operator_token != config.pg.operator_token || inparam.secret_key != config.pg.secret_key || inparam.currency_code != 'CNY') {
        return ctx.body = { data: null, error: { code: 1034, message: '无效的请求' } }
    }
    //验证参数
    let loginInfo = {}
    try {
        loginInfo = jwt.verify(inparam.operator_player_session, config.pg.gameKey)
    } catch (error) {
        return ctx.body = { data: null, error: { code: 3033, message: 'Bet failed' } }
    }
    //验证玩家
    const player = await new PlayerModel().getPlayerById(loginInfo.userId)
    //构造下注参数
    inparam.billType = 3
    inparam.gameType = config.pg.gameType
    inparam.amt = Math.abs(inparam.transfer_amount) * -1
    inparam.businessKey = `BPG_${player.userId}_${inparam.bet_id}`                        // 设置bk
    inparam.txnidTemp = `BET_${player.userId}_${inparam.transaction_id}`                  // 设置sn
    inparam.anotherGameData = JSON.stringify(inparam)                                     // 原始游戏信息
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    //返回结果
    if (amtAfter == 'err') {
        ctx.body = { data: null, error: { code: 3033, message: 'Bet failed' } }
    } else {
        ctx.body = { data: { currency_code: 'CNY', balance_amount: amtAfter, updated_time: inparam.updated_time }, error: null }
    }
})

// 返奖
router.post('/pg/Cash/TransferIn', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    if (inparam.operator_token != config.pg.operator_token || inparam.secret_key != config.pg.secret_key || inparam.currency_code != 'CNY') {
        return ctx.body = { data: null, error: { code: 1034, message: '无效的请求' } }
    }
    //验证参数
    let loginInfo = {}
    try {
        loginInfo = jwt.verify(inparam.operator_player_session, config.pg.gameKey)
    } catch (error) {
        return ctx.body = { data: null, error: { code: 3033, message: 'Bet failed' } }
    }
    //验证玩家
    const player = await new PlayerModel().getPlayerById(inparam.player_name)
    //构造返奖参数
    inparam.billType = 4
    inparam.gameType = config.pg.gameType
    inparam.amt = Math.abs(inparam.transfer_amount)
    inparam.businessKey = `BPG_${player.userId}_${inparam.bet_id}`                      // 设置bk
    inparam.txnidTemp = `WIN_${player.userId}_${inparam.transaction_id}`                // 设置sn
    inparam.anotherGameData = JSON.stringify(inparam)                                   // 原始游戏信息
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    //返回结果
    ctx.body = { data: { currency_code: 'CNY', balance_amount: amtAfter, updated_time: inparam.updated_time }, error: null }
})

/**
 * 玩家登出
 * @param {*} userId 玩家ID
 * @param {*} sid    具体游戏ID
 */
router.get('/pg/logout/:userId/:sid', async function (ctx, next) {
    // log.info(`准备退出玩家【${userId}】`)
    if (ctx.params.userId == 0) {
        return ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
    }
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.pg.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.pg.gameKey}`).toString(CryptoJS.enc.Hex)
    axios.post(config.na.exiturl, data).then(res => {
        res.data.code != 0 ? log.error(res.data) : null
    }).catch(err => {
        log.error(err)
    })
    // ctx.body = { code: 0, msg: '退出成功' }
    if (ctx.request.query.homeurl) {
        ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
    } else {
        ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
    }
})
module.exports = router