// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })

/**
 * 以第三方身份，测试免转钱包
 */
let player = { userNick: 'player004', balance: 10000 }
router.post('/stat/transfer', async function (ctx, next) {
    const inparam = ctx.request.body
    let amount = Math.abs(inparam.amount)
    switch (inparam.method) {
        case 'auth':
            if (inparam.userId == 'player004') {
                ctx.body = { code: 0, msg: '', ...player }
            } else {
                ctx.body = { code: -1, msg: '玩家不存在' }
            }
            console.log(player)
            break;
        case 'bet':
            amount *= -1
            player.balance += amount
            ctx.body = { code: 0, msg: '', balance: parseFloat(player.balance.toFixed(2)) }
            console.log(player)
            break;
        case 'win':
            player.balance += amount
            ctx.body = { code: 0, msg: '', balance: parseFloat(player.balance.toFixed(2)) }
            console.log(player)
            break;
        case 'refund':
            player.balance += amount
            ctx.body = { code: 0, msg: '', balance: parseFloat(player.balance.toFixed(2)) }
            console.log(player)
            break;
        default:
            break;
    }
    // // 业务操作
    // if (inparam.amount == -2) {
    //     ctx.body = { code: 2, msg: '余额不足', balance: 1 }
    // } else if (inparam.amount == -3) {
    //     ctx.body = { code: 0, msg: '下注重复流水', balance: 50 }
    // } else if (inparam.amount == 3) {
    //     ctx.body = { code: 0, msg: '返奖重复流水', balance: 50 }
    // } else if (inparam.amount == -4) {
    //     ctx.body = { code: 10, msg: '下注服务异常', balance: 0 }
    // } else if (inparam.amount == 4) {
    //     ctx.body = { code: 10, msg: '返奖服务异常', balance: 0 }// 需要游戏方持续重推
    // } else if (inparam.amount == -5) {
    //     // 下注不返回超时
    //     await waitASecond(12 * 1000)
    //     ctx.body = { code: 0, msg: '', balance: 20 }
    // } else if (inparam.amount == 5) {                        // 需要游戏方持续重推
    //     // 返奖不返回超时
    //     await waitASecond(12 * 1000)
    //     ctx.body = { code: 0, msg: '', balance: 20 }
    // }
    // else {
    //     ctx.body = { code: 0, msg: '操作成功', balance: 100 }
    // }
})

function waitASecond(waitTime) {
    // if (inparam.gameType == 50000 && Date.now() % 2 == 0) {
    console.log(`等待${waitTime}毫秒后再次查询`)
    return new Promise((reslove, reject) => {
        setTimeout(function () { reslove('Y') }, waitTime)
    })
    // }
}
module.exports = router