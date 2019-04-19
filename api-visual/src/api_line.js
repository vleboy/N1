// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const nodebatis = global.nodebatis
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })

//五分钟全局对象统计输赢金额
let winloseAmount = []

//累积统计5分钟输赢金额
router.get('/line/winloseAmount', async (ctx, next) => {
    console.time('实时统计耗时')
    let inparam = ctx.request.query
    inparam.inc = inparam.inc ? +inparam.inc : 1   //增量
    inparam.minute = inparam.minute ? +inparam.minute : 5 * 60   //时间区域
    if (winloseAmount.length == 0) { //初始
        inparam.startTime = new Date(new Date().toLocaleDateString()).getTime()  //获取当天零点时间
        inparam.endTime = Date.now() - 300000
        inparam.init = true
    } else {
        inparam.startTime = new Date(winloseAmount[winloseAmount.length - 1][0]).getTime()
        inparam.endTime = inparam.startTime + inparam.inc * 1000
    }
    // 获取区域玩家总输赢
    let res = await nodebatis.query('bill.winloseAmountDay', { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    let addNum = res[0].total ? res[0].total : 0
    if (inparam.init) {
        winloseAmount.push([new Date(inparam.endTime).Format('yyyy-MM-dd hh:mm:ss'), addNum])
    } else {
        let lastArr = winloseAmount[winloseAmount.length - 1]  //取出最后一个
        if (winloseAmount.length == inparam.minute / inparam.inc) {
            winloseAmount.shift()  // 删除第一个
        }
        winloseAmount.push([new Date(inparam.endTime).Format('yyyy-MM-dd hh:mm:ss'), lastArr[1] + addNum])  //加入新的
    }
    ctx.body = { code: 0, data: winloseAmount }
    console.timeEnd('实时统计耗时')
})


/**
 *  日报表折线图统计
 */
router.get('/line/day', async (ctx, next) => {
    console.time('日报表折线图统计耗时')
    let inparam = ctx.request.query
    //当天全局折线图map
    let lineMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        refundAmount: [],
        winloseAmount: []
    }
    let promiseArr = []
    // 获取区域玩家总人数
    promiseArr.push(queryGetLine('bill.playerCountDay', inparam, 'playerCount', lineMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetLine('bill.handleAmountDay', inparam, 'betCount', lineMap), 3)
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetLine('bill.handleAmountDay', inparam, 'betAmount', lineMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetLine('bill.handleAmountDay', inparam, 'retAmount', lineMap, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetLine('bill.handleAmountDay', inparam, 'refundAmount', lineMap, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetLine('bill.handleAmountDay', inparam, 'winloseAmount', lineMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: lineMap }
    console.timeEnd('日报表折线图统计耗时')
})

// 折线图sql查询
async function queryGetLine(sqlName, inparam, key, map, type) {
    if (type) { inparam.type = type }
    let res = await nodebatis.query(sqlName, { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType, type: inparam.type })
    for (let item of res) {
        if (key == 'betAmount') {
            map[key].push({ x: item.days, y: Math.abs(item.count) })
        } else {
            map[key].push({ x: item.days, y: Math.abs(item.count) })
        }
    }
}

// 私有日期格式化方法
Date.prototype.Format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份 
        "d+": this.getDate(), //日 
        "h+": this.getHours(), //小时 
        "m+": this.getMinutes(), //分 
        "s+": this.getSeconds(), //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds() //毫秒 
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}


module.exports = router