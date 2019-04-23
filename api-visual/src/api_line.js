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
    promiseArr.push(queryGetLine('bill.playerCountDay', 'playerCount', inparam, lineMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetLine('bill.handleAmountDay', 'betCount', inparam, lineMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetLine('bill.handleAmountDay', 'betAmount', inparam, lineMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetLine('bill.handleAmountDay', 'retAmount', inparam, lineMap, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetLine('bill.handleAmountDay', 'refundAmount', inparam, lineMap, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetLine('bill.handleAmountDay', 'winloseAmount', inparam, lineMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: lineMap }
    console.timeEnd('日报表折线图统计耗时')
})

// 玩家注册折线图
router.get('/line/player', async (ctx, next) => {
    console.time('玩家折线图统计耗时')
    let inparam = ctx.request.query
    //查询时间段的每天注册人数
    let p1 = nodebatis.query('player.queryRegisterDay', inparam)
    //查询该时间段之前的所有注册人数
    let p2 = nodebatis.query('player.querycountDay', { startTime: 0, endTime: new Date(new Date(+inparam.endTime).setHours(0, 0, 0, 0)).getTime() - 1 })
    let [res, resTotal] = await Promise.all([p1, p2])
    // 初始折线图数据
    let lineMap = {
        everyDay: [],  //每天注册数
        sumDay: []     //历史累计注册数
    }
    for (let i = +inparam.startTime; i <= +inparam.endTime; i += 24 * 60 * 60 * 1000) {
        lineMap.everyDay.push([new Date(i).Format('yyyy-MM-dd'), 0])
        lineMap.sumDay.push([new Date(i).Format('yyyy-MM-dd'), resTotal[0].total])
    }
    // 更新到对应时间每天注册数
    for (let item of lineMap.everyDay) {
        for (let info of res) {
            if (item[0] == info.days) {
                item[1] = info.count
                break;
            }
        }
    }
    let sumarr = []  //需要累加的每天注册数
    for (let i = 0; i < lineMap.everyDay.length; i++) {
        let newArr = [lineMap.everyDay[i][0], 0]
        for (var j = 0; j <= i; j++) {
            newArr[1] += lineMap.everyDay[j][1]
        }
        sumarr.push(newArr)
    }
    //  更新历史累计注册数
    for (let item of lineMap.sumDay) {
        for (let info of sumarr) {
            if (item[0] == info[0]) {
                item[1] += info[1]
                break;
            }
        }
    }
    ctx.body = { code: 0, data: lineMap }
    console.timeEnd('玩家折线图统计耗时')
})

// 折线图sql查询
async function queryGetLine(sqlName, key, inparam, map, type) {
    let res = await nodebatis.query(sqlName, { method: key, type, ...inparam })
    for (let item of res) {
        if (key == 'betAmount') {
            map[key].push({ x: item.days, y: Math.abs(item.count) })
        } else {
            map[key].push({ x: item.days, y: item.count })
        }
    }
}

// //五分钟全局对象统计输赢金额
// let winloseAmount = []

// //累积统计5分钟输赢金额
// router.get('/line/winloseAmount', async (ctx, next) => {
//     console.time('实时统计耗时')
//     let inparam = ctx.request.query
//     inparam.inc = inparam.inc ? +inparam.inc : 1   //增量
//     inparam.minute = inparam.minute ? +inparam.minute : 5 * 60   //时间区域
//     if (winloseAmount.length == 0) { //初始
//         inparam.startTime = new Date(new Date().toLocaleDateString()).getTime()  //获取当天零点时间
//         inparam.endTime = Date.now() - 300000
//         inparam.init = true
//     } else {
//         inparam.startTime = new Date(winloseAmount[winloseAmount.length - 1][0]).getTime()
//         inparam.endTime = inparam.startTime + inparam.inc * 1000
//     }
//     // 获取区域玩家总输赢
//     let res = await nodebatis.query('bill.winloseAmountDay', { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
//     let addNum = res[0].total ? res[0].total : 0
//     if (inparam.init) {
//         winloseAmount.push([new Date(inparam.endTime).Format('yyyy-MM-dd hh:mm:ss'), addNum])
//     } else {
//         let lastArr = winloseAmount[winloseAmount.length - 1]  //取出最后一个
//         if (winloseAmount.length == inparam.minute / inparam.inc) {
//             winloseAmount.shift()  // 删除第一个
//         }
//         winloseAmount.push([new Date(inparam.endTime).Format('yyyy-MM-dd hh:mm:ss'), lastArr[1] + addNum])  //加入新的
//     }
//     ctx.body = { code: 0, data: winloseAmount }
//     console.timeEnd('实时统计耗时')
// })

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