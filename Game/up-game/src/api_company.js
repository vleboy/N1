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
// const CompanyModel = require('./model/CompanyModel')
// const LogModel = require('./model/LogModel')
// const CompanyCheck = require('./biz/CompanyCheck')
const BizErr = require('./lib/Codes').BizErr
const CompanyEnum = require('./lib/Consts').companyEnum

//  厂商列表
router.post('/companyList', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作  
    // const ret = await new CompanyModel().listCompany(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: CompanyEnum }
})

// 单个厂商
router.get('/companyOne/:companyName/:companyId', async function (ctx, next) {
    let inparam = ctx.params
    let token = ctx.tokenVerify
    // 参数校验
    if (!inparam.companyName || !inparam.companyId) {
        throw BizErr.InparamErr()
    } else {
        inparam.companyName = decodeURIComponent(inparam.companyName)
    }
    // 业务操作
    // const ret = await new CompanyModel().getOne(inparam)
    const ret = _.find(companyEnum, (o) => { return o.companyName == inparam.companyName })
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 通过厂商名称获取单个厂商
router.get('/companyOne/:companyName', async function (ctx, next) {
    let inparam = ctx.params
    let token = ctx.tokenVerify
    // 参数校验
    if (!inparam.companyName) {
        throw BizErr.InparamErr()
    } else {
        inparam.companyName = decodeURIComponent(inparam.companyName)
    }
    // 业务操作
    // const ret = await new CompanyModel().getOne(inparam)
    const ret = _.find(companyEnum, (o) => { return o.companyName == inparam.companyName })
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 创建厂商
// router.post('/companyNew', async function (ctx, next) {
//     let companyInfo = ctx.request.body
//     let token = ctx.tokenVerify
//     //检查参数是否合法
//     new CompanyCheck().checkCompany(companyInfo)
//     // 业务操作
//     const addCompanyRet = await new CompanyModel().addCompany(companyInfo)
//     // 操作日志记录
//     companyInfo.operateAction = '创建厂商'
//     companyInfo.operateToken = token
//     new LogModel().addOperate(companyInfo, null, addCompanyRet)
//     // 结果返回
//     ctx.body = { code: 0, payload: addCompanyRet }
// })

// // 厂商状态变更，接口编号：
// router.post('/companyChangeStatus', async function (ctx, next) {
//     let inparam = ctx.request.body
//     //检查参数是否合法
//     new CompanyCheck().checkStatus(inparam)
//     // 业务操作
//     const ret = await new CompanyModel().changeStatus(inparam.companyName, inparam.companyId, inparam.status)
//     // 操作日志记录
//     inparam.operateAction = '厂商状态变更'
//     inparam.operateToken = ctx.tokenVerify
//     new LogModel().addOperate(inparam, null, ret)
//     // 结果返回
//     ctx.body = { code: 0, payload: ret }
// })

// //变更厂商
// router.post('/companyUpdate', async function (ctx, next) {
//     let inparam = ctx.request.body
//     let token = ctx.tokenVerify
//     // 检查参数是否合法
//     new CompanyCheck().checkUpdate(inparam)
//     // 业务操作
//     const ret = await new CompanyModel().update(inparam)
//     // 操作日志记录
//     inparam.operateAction = '厂商更新'
//     inparam.operateToken = token
//     new LogModel().addOperate(inparam, null, ret)
//     // 结果返回
//     ctx.body = { code: 0, payload: ret }
// })

module.exports = router