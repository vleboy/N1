// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require('crypto-js')
const parseString = require('xml2js').parseString
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
// const NASign = require('./lib/NASign')
// const redis = require('redis')
// const redisClient = redis.createClient({ url: 'redis://redis-19126.c1.ap-southeast-1-1.ec2.cloud.redislabs.com:19126' })

/**
 * TTG PC版本游戏链接
 * gameName 游戏名称
 * gameId 游戏大类
 * sid    游戏小类
 * userName 玩家帐号
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/ttg/gameurl/:gameName/:gameId/:sid/:userName/:userId/:token', async function (ctx, next) {
    let finalUrl = ''
    if (ctx.params.userId == 0) {
        finalUrl = `http://pff.ttms.co/casino/default/game/casino5.html?playerHandle=999999&account=FunAcct&gameName=${ctx.params.gameName}&gameType=0&gameId=${(+ctx.params.sid) - (+ctx.params.gameId)}&lang=zh-cn&lsdId=zero&deviceType=web&t=${Date.now()}`
    } else {
        // 请求N1服务器是否允许玩家进入游戏
        const nares = await axios.post(config.na.joingameurl, {
            userId: ctx.params.userId,
            gameId: ctx.params.gameId,
            sid: ctx.params.sid,
            token: inparam.token
        })
        // 判断玩家是否在其他游戏中
        if (nares.data.code != 0) {
            ctx.body = { code: nares.data.code, msg: nares.data.msg }
            return
        }
        // 指定线路号的玩家为测试号
        let tester = 0
        // if (ctx.request.body.msn == '159') {
        //     tester = 1
        // }
        // 从TTG获取玩家TOKEN
        // log.info(`请求TTG【POST】${config.ttg.tokenurl}NA_${ctx.params.userName}`)
        // log.info(`请求TTG【参数】<logindetail><player account="CNY" country="CN" firstName="" lastName="" userName="" nickName="" tester="${tester}" partnerId="NA" commonWallet="1" /><partners><partner partnerId="zero" partnerType="0" /><partner partnerId="NA" partnerType="1" /></partners></logindetail>`)
        const res = await axios.post(config.ttg.tokenurl + `NA_${ctx.params.userName}`, `<logindetail><player account="CNY" country="CN" firstName="" lastName="" userName="" nickName="" tester="${tester}" partnerId="NA" commonWallet="1" /><partners><partner partnerId="zero" partnerType="0" /><partner partnerId="NA" partnerType="1" /></partners></logindetail>`, {
            headers: { 'Content-Type': 'application/xml' }
        })
        const finalRes = await xmlParse(res.data)
        // log.info(`登录TTG返回数据：${res.data}`)
        finalUrl = `${config.ttg.gameurl}?playerHandle=${finalRes.gametoken.$.token}&account=CNY&gameName=${ctx.params.gameName}&gameType=0&gameId=${(+ctx.params.sid) - (+ctx.params.gameId)}&lang=zh-cn&lsdId=zero&deviceType=web&t=${Date.now()}`
    }
    // log.info(`TTG最终游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)

})

/**
 * TTG第三方服务查询余额
 * @param {*} acctid 玩家帐号
 */
router.post('/ttg/balance', async function (ctx, next) {
    const player = await new PlayerModel().getPlayer(ctx.request.body.cw.$.acctid.substring(3))
    if (!player || _.isEmpty(player)) {
        ctx.body = '<cw type="getBalanceResp" err="1000" />'
        log.error(`玩家【${ctx.request.body.cw.$.acctid.substring(3)}】不存在`)
        return
    } else {
        ctx.body = `<cw type="getBalanceResp" cur="CNY" amt="${player.balance}" err="0" />`
    }
})

/**
 * TTG第三方服务推送流水
 * @param {*} acctid 玩家帐号
 * @param {*} amt    流水变化
 */
router.post('/ttg/fund', async function (ctx, next) {
    // 查询玩家
    const player = await new PlayerModel().getPlayer(ctx.request.body.cw.$.acctid.substring(3))
    if (!player || _.isEmpty(player)) {
        ctx.body = '<cw type="getBalanceResp" err="1000" />'
        log.error(`玩家【${ctx.request.body.cw.$.acctid.substring(3)}】不存在`)
        return
    }
    // 计算玩家实时余额和更新
    ctx.request.body.cw.$.gameType = config.ttg.gameType    // TODO:从配置文件获取游戏类型，未来考虑自动获取
    ctx.request.body.cw.$.businessKey = `BTTG_${player.userName}_${ctx.request.body.cw.$.handid}`    // 设置局号
    ctx.request.body.cw.$.txnid = `${ctx.request.body.cw.$.txnid}`                                   // 设置第三方系统唯一流水号
    ctx.request.body.cw.$.txnidTemp = `${player.userName}_${ctx.request.body.cw.$.txnid}`            // 缓存第三方系统唯一流水号
    const amtAfter = await new PlayerModel().updatebalance(player, ctx.request.body.cw.$)
    if (amtAfter == 'err') {
        ctx.body = '<cw type="fundTransferResp" err="9999" />'
    } else {
        // 返回实时余额
        ctx.body = `<cw type="fundTransferResp" cur="CNY" amt="${amtAfter}" err="0" />`
    }
})

/**
 * 玩家登出
 * @param {*} userId 玩家ID
 * @param {*} sid    具体游戏ID
 */
router.get('/ttg/logout/:userId/:sid', async function (ctx, next) {
    // log.info(`准备退出玩家【${userId}】`)
    if (ctx.params.userId == 0) {
        return ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
    }
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.ttg.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.ttg.gameKey}`).toString(CryptoJS.enc.Hex)
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

// 私有方法：XML解析
function xmlParse(xml) {
    return new Promise((reslove, reject) => {
        parseString(xml, function (err, res) {
            reslove(res)
        })
    })
}

// function cacheGet(key) {
//     return new Promise((reslove, reject) => {
//         redisClient.get(key, (err, value) => {
//             if (err) reject(err)
//             reslove(value)
//         })
//     })
// }
// function cacheSet(key, value) {
//     return new Promise((reslove, reject) => {
//         redisClient.set(key, value, (err) => {
//             if (err) reject(err)
//             reslove(value)
//         })
//     })
// }

module.exports = router