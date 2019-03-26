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
const LogModel = require('./model/LogModel')
const SubRoleModel = require('./model/SubRoleModel')
const SubRoleCheck = require('./biz/SubRoleCheck')

// 创建子角色
router.post('/subRoleNew', async function (ctx, next) {
  let subRoleInfo = ctx.request.body
  let token = ctx.tokenVerify
  //检查参数是否合法
  new SubRoleCheck().checkSubRole(subRoleInfo)
  // 业务操作
  const ret = await new SubRoleModel().addSubRole(subRoleInfo)
  // 操作日志记录
  subRoleInfo.operateAction = '创建子角色'
  subRoleInfo.operateToken = token
  new LogModel().addOperate(subRoleInfo, null, ret)
  // 返回结果
  ctx.body = { code: 0, payload: ret }
})

// 子角色列表
router.post('/subRoleList', async function (ctx, next) {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 业务操作  
  const ret = await new SubRoleModel().listSubRole(inparam)
  // 返回结果
  ctx.body = { code: 0, payload: ret }
})

// 更新子角色
router.post('/subRoleUpdate', async function (ctx, next) {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 检查参数是否合法
  new SubRoleCheck().checkSubRole(inparam)
  // 业务操作
  const ret = await new SubRoleModel().update(inparam)
  // 操作日志记录
  inparam.operateAction = '子角色更新'
  inparam.operateToken = token
  new LogModel().addOperate(inparam, null, ret)
  // 返回结果
  ctx.body = { code: 0, payload: ret }
})

// 删除子角色
router.post('/subRoleDelete', async function (ctx, next) {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 业务操作
  const ret = await new SubRoleModel().delete(inparam)
  // 操作日志记录
  inparam.operateAction = '子角色删除'
  inparam.operateToken = token
  new LogModel().addOperate(inparam, null, ret)
  // 返回结果
  ctx.body = { code: 0, payload: ret }
})

module.exports = router