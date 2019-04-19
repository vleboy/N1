// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const moment = require('moment')
const crypto = require('crypto')
const qs = require('querystring')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}

/**
 * 玩家上线
 * @param {*} gameId NA游戏大类
 * @param {*} sid NA游戏ID
 * @param {*} userId NA玩家ID，0是试玩
 * @param {*} token NA玩家TOKEN，0是试玩
 * @param {*} lobbyType 0是电脑版，1是移动版 */
router.get('/ky/gameurl/:gameId/:sid/:userId/:token', async (ctx, next) => {
    let ip = ipMap[ctx.params.userId] = ctx.request.ip
    const inparam = ctx.params
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, {
        userId: inparam.userId,
        gameId: inparam.gameId,
        sid: inparam.sid,
        token: inparam.token
    })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    // 获取玩家的余额，全部上分
    const lineCode = inparam.lineCode || 'NA'                                                                     //代理下面的站点标识
    const account = inparam.userId                                                                                //玩家账号
    let player = await new PlayerModel().getPlayerById(account)
    const money = player.balance                                                                                  //玩家的余额
    let orderid = config.ky.agent + moment().utcOffset(8).format("YYYYMMDDHHmmssSSS") + account                   //流水号
    let res = false
    let checkRes = true
    try {
        res = await axios.get(getURL(0, `s=0&account=${account}&money=${money}&lineCode=${lineCode}&ip=${ip}&orderid=${orderid}&KindId=0`))
    } catch (error) {
        checkRes = await checkOrder(orderid)
    }
    log.info(res)
    if (checkRes && res && res.data.d.code == 0) {
        //如果操作成功则模拟下注
        const updateParams = { billType: 3 }
        updateParams.amt = money * -1
        updateParams.gameType = config.ky.gameType
        updateParams.businessKey = `BKY_${account}_${orderid}`
        let amtAfter = await new PlayerModel().updatebalance(player, updateParams)
        // 下注失败则下分回滚
        if (amtAfter == 'err') {
            orderid = config.ky.agent + moment().utcOffset(8).format("YYYYMMDDHHmmssSSS") + account
            try {
                res = await axios.get(getURL(3, `s=0&account=${account}&money=${money}&orderid=${orderid}`))
            } catch (error) {
                checkRes = await checkOrder(orderid)
                if (!checkRes) {
                    // TODO 记录下分失败的日志
                }
            }
            ctx.body = { code: 404, message: "发生错误了" }
        } else {
            ctx.redirect(res.data.d.url)
        }
    } else {
        ctx.body = { code: res.data.d.code, message: "上分失败", err: res.data.d }
    }
})

/**
 * 玩家下线（提供给ky的回调通知）
 */
router.get('/ky/logout', async (ctx, next) => {
    // 获取入参
    const account = qs.parse(desDecode(config.ky.desKey, ctx.request.query.param)).account
    // 获取玩家的余额
    let res = await axios.get(getURL(1, `s=1&account=${account}`), { timeout: 100 * 1000 })
    const money = res.data.d.money
    // 全部下分
    let checkRes = true
    try {
        const orderid = config.ky.agent + moment().utcOffset(8).format("YYYYMMDDHHmmssSSS") + account
        res = await axios.get(getURL(3, `s=0&account=${account}&money=${money}&orderid=${orderid}`))
    } catch (error) {
        checkRes = await checkOrder(orderid)
    }
    if (checkRes && res.data.d.code == 0) {
        //模拟下注0
        let player = await new PlayerModel().getPlayerById(account)
        const updateParams1 = { billType: 3 }
        updateParams1.amt = 0
        updateParams1.gameType = config.ky.gameType
        updateParams1.businessKey = `BKY_${account}_${orderId}`
        let amtAfter = await new PlayerModel().updatebalance(player, updateParams1)
        if (amtAfter == 'err') {
            return ctx.body = { code: 404, message: "发生错误了" }
        }
        //模拟返奖
        player = await new PlayerModel().getPlayerById(account)
        const updateParams2 = { billType: 4 }
        updateParams2.amt = money
        updateParams2.gameType = config.ky.gameType
        updateParams2.businessKey = `BKY_${account}_${orderId}`
        amtAfter = await new PlayerModel().updatebalance(player, updateParams2)
        if (amtAfter == 'err') {
            return ctx.body = { code: 404, message: "发生错误了" }
        }
        // 请求N1退出
        axios.post(config.na.exiturl, {
            exit: 1,
            userId: account,
            gameType: config.ky.gameType,
            gameId: config.ky.gameId,
            timestamp: Date.now()
        }).then(res => {
            res.data.code != 0 ? log.error(res.data) : null
        }).catch(err => {
            log.error(err)
        })
    } else {
        // TODO 记录下分失败日志
        ctx.body = { code: res.data.d.code, message: "下分失败", err: res.data.d }
    }
})

/**
 * 获取游戏注单（拉去时间最大不能超过60分钟）
 */
router.post('/ky/betdetail', async (ctx, next) => {
    //获取入参
    let inparam = ctx.request.body
    let startTime = inparam.startTime                                                           //开始时间
    let endTime = inparam.endTime                                                               //结束时间                                       
    let param = param = `s=6&startTime=${startTime}&endTime=${endTime}`
    //获取请求url
    let url = getURL(6, param)
    let res = await axios.get(url, { timeout: 100 * 1000 })
    //根据操作类型做相应处理
    if (res.data.d.code == 0) {
    } else {
        ctx.body = { code: -1, msg: '操作失败', err: res.data }
    }
})

/**
 * 查询/踢玩家下线接口
 * @param s 操作类型 1：查询玩家可下分余额 5：查询玩家是否在线 7：查询游戏总余额 8：根据玩家账号提玩家下线
 * @param account 玩家账号
 */
router.get('/ky/:s/:account', async (ctx, next) => {
    //获取入参
    let inparam = ctx.params
    let account = inparam.account                                                               //会员账号
    let s = inparam.s                                                                           //操作子类型
    let param = `s=${s}&account=${account}`
    //获取请求url
    let url = getURL(parseInt(s), param)
    let response = await axios.get(url, { timeout: 100 * 1000 })
    //根据操作类型做相应处理
    if (response.data.d.code == 0) {
        switch (parseInt(s)) {
            case 1://查询玩家可下分余额
                ctx.body = { code: 0, message: "success", money: response.data.d.money }
                break;
            case 5://查询玩家是否在线
                ctx.body = { code: 0, message: "success", status: response.data.d.status }
                break;
            case 7://查询游戏总余额
                ctx.body = { code: 0, message: "success", totalMoney: response.data.d.totalMoney, freeMoney: response.data.d.freeMoney }
                break;
            case 8://根据玩家账号提玩家下线
                //如果是踢玩家下线那么应该做些什么处理？？？？
                //通知服务器，查询可下分余额并返奖等。。。。
                //未完！！！
                ctx.body = { code: 0, message: "success" }
                break;
        }
    } else {
        ctx.body = { code: -1, msg: '操作失败', err: response.data }
    }
})
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

// 间隔5秒请求一次订单状态，直到确认返回
async function checkOrder(orderid) {
    try {
        res = await axios.get(getURL(0, `s=4&orderid=${orderid}`))
        if (res.data.d.code == 0) {
            if (res.data.d.status == 0) {
                return true
            }
            if (res.data.d.status == -1 || res.data.d.status == 2) {
                return false
            }
            if (res.data.d.status == 3) {
                checkOrder(orderid)
            }
        } else {
            log.error('KY棋牌检查订单异常')
            checkOrder(orderid)
        }
    } catch (error) {
        log.error('KY棋牌检查订单超时')
        setTimeout(() => {
            checkOrder(orderid)
        }, 5000)
    }
}
// 组装获取请求的url
function getURL(s, param) {
    let timestamp = Date.now()
    let url = s != 6 ? config.ky.apiUrl : config.ky.recordUrl
    url = url + "?" + qs.stringify({
        agent: config.ky.agent,
        timestamp: timestamp,
        param: desEncode(config.ky.desKey, param),
        key: crypto.createHash('md5').update(config.ky.agent + timestamp.toString() + config.ky.md5key).digest('hex'),
    })
    return url
}
// DES解密
function desDecode(desKey, data) {
    var cipherChunks = [];
    var decipher = crypto.createDecipheriv('aes-128-ecb', desKey, '');
    decipher.setAutoPadding(true);
    cipherChunks.push(decipher.update(data, 'base64', 'utf8'));
    cipherChunks.push(decipher.final('utf8'));
    return cipherChunks.join('');
}
// DES加密
function desEncode(desKey, data) {
    var cipherChunks = [];
    var cipher = crypto.createCipheriv('aes-128-ecb', desKey, '');
    cipher.setAutoPadding(true);
    cipherChunks.push(cipher.update(data, 'utf8', 'base64'));
    cipherChunks.push(cipher.final('base64'));

    return cipherChunks.join('');
}

module.exports = router