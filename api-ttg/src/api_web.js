// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
// const jwt = require('jsonwebtoken')
// const _ = require('lodash')
const IP2Region = require('ip2region')
const ipquery = new IP2Region()
const axios = require('axios')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const globalIpTemp = {}
const ConfigModel = require('./model/ConfigModel')

/**
 * IP查询
 */
router.get('/webapi/ipquery', async function (ctx, next) {
    let country = '中国'
    let configRes = await new ConfigModel().getOne({ code: 'appVersion' })
    let n1version = configRes.n1Version
    let n2version = '0004'
    let zyzxversion = '1003'
    const res = ipquery.search(ctx.request.ip)
    if (res) {
        country = res.country
    }else{
        country = '国外'
    }
    // // 从缓存中查询
    // if (globalIpTemp[ctx.request.ip]) {
    //     country = globalIpTemp[ctx.request.ip]
    // }
    // // 请求IP查询
    // else {
    //     try {
    //         // 淘宝IP查询
    //         let res = await axios.get(`http://ip.taobao.com/service/getIpInfo.php?ip=${ctx.request.ip}`)
    //         country = res.data.data.country
    //         globalIpTemp[ctx.request.ip] = country
    //     } catch (error) {
    //         // 其他IP查询
    //         let res2 = await axios.get(`http://freeapi.ipip.net/${ctx.request.ip}`)
    //         if (res2.data && res2.data.length > 0) {
    //             country = res2.data[0]
    //             globalIpTemp[ctx.request.ip] = country
    //         }
    //     }
    // }
    log.info(country)
    ctx.body = { payload: { data: { country, n1version, n2version, zyzxversion } } }
})

/***
 * APP下载跳转
 */
router.get('/webapi/scan/:projectname/:plat', async function (ctx, next) {
    const inparam = ctx.params
    let country = '中国'
    let configRes = await new ConfigModel().getOne({ code: 'appVersion' })
    let aapokerVersion = configRes.aapokerVersion  //AA扑克当前版本号
    // 从缓存中查询
    if (globalIpTemp[ctx.request.ip]) {
        country = globalIpTemp[ctx.request.ip]
    }
    // 请求IP查询
    else {
        try {
            // 淘宝IP查询
            let res = await axios.get(`http://ip.taobao.com/service/getIpInfo.php?ip=${ctx.request.ip}`)
            country = res.data.data.country
            globalIpTemp[ctx.request.ip] = country
        } catch (error) {
            // 其他IP查询
            let res2 = await axios.get(`http://freeapi.ipip.net/${ctx.request.ip}`)
            if (res2.data && res2.data.length > 0) {
                country = res2.data[0]
                globalIpTemp[ctx.request.ip] = country
            }
        }
    }
    if (inparam.plat == 'ios') {
        if (country == '中国') {
            ctx.redirect(`itms-services://?action=download-manifest&url=https://assetdownload.oss-cn-hangzhou.aliyuncs.com/aapoker/${aapokerVersion}.plist`)

        } else {
            ctx.redirect(`itms-services://?action=download-manifest&url=https://s3-ap-southeast-1.amazonaws.com/oss.aapoker/${aapokerVersion}.plist`)
        }
    } else {
        if (country == '中国') {
            ctx.redirect(`http://app.risheng3d.com/aapoker/${aapokerVersion}.apk`)
        } else {
            ctx.redirect(`https://s3-ap-southeast-1.amazonaws.com/oss.aapoker/${aapokerVersion}.apk`)
        }
    }
})

/**
 * 测试SSL
 */
router.get('/webapi/test', async function (ctx, next) {
    ctx.body = 'ssl work'
})

// 允许跨域访问
// router.options('/webapi/*', async function (ctx, next) {
//     log.info(ctx.request.header.origin)
//     ctx.set("Access-Control-Allow-Origin", ctx.request.header.origin)
//     ctx.set("Access-Control-Allow-Credentials", true)
//     ctx.set("Access-Control-Max-Age", 86400000)
//     ctx.set("Access-Control-Allow-Methods", "OPTIONS, GET, PUT, POST, DELETE")
//     ctx.set("Access-Control-Allow-Headers", "x-requested-with, accept, origin, content-type")
//     ctx.body = ''
// })

module.exports = router