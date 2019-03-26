const config = require('config')
const { PORT = 3000 } = process.env
// 应用服务与中间件相关
const Koa = require('koa')
const koaBody = require('koa-body')
const xerror = require('koa-xerror')
const xauth = require('koa-xauth')
const xlog = require('koa-xlog')
// const mount = require('koa-mount')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })

// 业务控制器
const pingRoute = require('./src/api_ping')
const adminRoute = require('./src/api_admin')
const managerRoute = require('./src/api_manager')
const merchantRoute = require('./src/api_merchant')
const captchaRoute = require('./src/api_captcha')
const configRoute = require('./src/api_config')
const queryRoute = require('./src/api_query')
const calcRoute = require('./src/api_calc')
const uploadRoute = require('./src/api_upload')
const adRoute = require('./src/api_ad')
const billRoute = require('./src/api_bill')
const subroleRoute = require('./src/api_subrole')
const playerRoute = require('./src/api_player')
const emailRoute = require('./src/api_email')
const noticeRoute = require('./src/api_notice')
const statRoute = require('./src/api_sys_stat')
const fixRoute = require('./src/api_fix')
const hallRoute = require('./src/api_hall')
const transferRoute = require('./src/api_transfer')

// const msnRoute = require('./src/api_msn')
const mysteryRoute = require('./src/api_mystery')
// const rankRoute = require('./src/api_rank')
// const organizeRoute = require('./src/api_organize')
// const emailManagerRoute = require('./src/api_email_manager')
// const noticeManagerRoute = require('./src/api_notice_manager')

// 初始化应用服务，加载所有中间件
const app = new Koa()
app.proxy = true
app.use(xerror(config.error, (ctx, err) => {   // 全局错误捕获中间件，必须第一位使用，参数1：错误配置，参数2：自定义错误处理
    if (ctx.status == 400) {
        ctx.status = 200
        ctx.body.code = -1
        ctx.body.msg = '非法入参'
    }
    else if (!ctx.body.code) {
        ctx.body.code = -1
        ctx.body.msg = '内部系统异常'
    }
}))
app.use(koaBody())                              // 入参JSON解析中间件
app.use(xlog(config.log, (ctx) => {             // 日志中间件，参数1：日志配置，参数2：额外日志处理
    // 统一输入数据trim处理
    if (ctx.request.body) {
        for (let i in ctx.request.body) {
            if (typeof (ctx.request.body[i]) == 'string') {
                ctx.request.body[i] = ctx.request.body[i].trim()
                if (ctx.request.body[i] == 'NULL!' || ctx.request.body[i] == '') {
                    ctx.request.body[i] = null
                }
            }
        }
    }
}))
app.use(xauth(config.auth, (v) => {             // TOKEN身份认证中间件，参数1：认证配置，参数2：额外自定义TOKEN解析规则，参数3：自定义错误处理
    let words = v.split(" ")
    return words.length > 1 ? words[1] : words[0]
}, (ctx) => {
    if (ctx.body.name == 'TokenExpiredError') {
        ctx.body.code = -2
        ctx.body.msg = 'TOKEN已过期'
    } else if (ctx.body.err) {
        if (ctx.body.res && ctx.body.res.indexOf("未配置访问权限")) {
            ctx.body.code = 14001
            ctx.body.msg = "没有权限"
        } else {
            ctx.body.code = 11000
            ctx.body.msg = "token错误"
        }
    }
}))

app.use(pingRoute.routes())             // 心跳接口
app.use(adminRoute.routes())            // 管理员接口
app.use(managerRoute.routes())          // 线路商接口
app.use(merchantRoute.routes())         // 商户接口
app.use(captchaRoute.routes())          // 验证码接口
app.use(configRoute.routes())           // 系统配置接口服务
app.use(uploadRoute.routes())           // 图片上传

app.use(queryRoute.routes())            // 报表查询接口
app.use(calcRoute.routes())             // 报表统计接口

app.use(playerRoute.routes())           // 玩家管理接口(新)
app.use(billRoute.routes())             // 账单日志接口
app.use(adRoute.routes())               // 公告管理接口
app.use(emailRoute.routes())            // 邮件接口(新)
app.use(noticeRoute.routes())           // 跑马灯接口(新)
app.use(subroleRoute.routes())          // 子角色接口
app.use(statRoute.routes())             // 看板接口
app.use(fixRoute.routes())              // 修正接口
app.use(hallRoute.routes())             // 大厅请求接口
app.use(transferRoute.routes())         // 共享钱包流水请求接口

// app.use(msnRoute.routes())              // 线路号接口
app.use(mysteryRoute.routes())          // 神秘大奖接口
// app.use(rankRoute.routes())             // 排行榜
// app.use(organizeRoute.routes())         // 组织架构
// app.use(emailManagerRoute.routes())     // 邮件接口(旧)
// app.use(noticeManagerRoute.routes())    // 跑马灯接口(旧)

app.use(function (ctx, next) {
    ctx.status = 404
    ctx.body = {
        code: 404,
        msg: "not fount"
    }
})

// 启动应用服务
app.listen(PORT)
log.info(`up-koa服务启动【执行环境:${process.env.NODE_ENV},端口:${PORT},${config.log.level},${config.env.IMG_BUCKET}】`)
