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
 * 中国地图统计
 */
router.get('/map/china', async (ctx, next) => {
    console.time('中国地图查询用时')
    let inparam = ctx.request.query
    inparam.queryFlag = 'province'
    let promiseArr = []
    // 获取区域玩家总人数
    promiseArr.push(queryGetSql('bill.chinaPlayerCount', 'playerCount', inparam))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetSql('bill.chinaHandleAmount', 'betCount', inparam, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetSql('bill.chinaHandleAmount', 'betAmount', inparam, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetSql('bill.chinaHandleAmount', 'retAmount', inparam, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetSql('bill.chinaHandleAmount', 'refundAmount', inparam, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetSql('bill.chinaHandleAmount', 'winloseAmount', inparam))
    let chinaArr = await Promise.all(promiseArr)
    ctx.body = { code: 0, data: { playerCount: chinaArr[0], betCount: chinaArr[1], betAmount: chinaArr[2], retAmount: chinaArr[3], refundAmount: chinaArr[4], winloseAmount: chinaArr[5] } }
    console.timeEnd('中国地图查询用时')
})

/**
 * 世界地图统计
 */
router.get('/map/world', async (ctx, next) => {
    console.time('世界地图查询用时')
    let inparam = ctx.request.query
    inparam.queryFlag = 'country'
    let promiseArr = []
    // 获取区域玩家总人数
    promiseArr.push(queryGetSql('bill.worldPlayerCount', 'playerCount', inparam))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetSql('bill.worldHandleAmount', 'betCount', inparam, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetSql('bill.worldHandleAmount', 'betAmount', inparam, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetSql('bill.worldHandleAmount', 'retAmount', inparam, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetSql('bill.worldHandleAmount', 'refundAmount', inparam, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetSql('bill.worldHandleAmount', 'winloseAmount', inparam))
    let worldArr = await Promise.all(promiseArr)
    ctx.body = { code: 0, data: { playerCount: worldArr[0], betCount: worldArr[1], betAmount: worldArr[2], retAmount: worldArr[3], refundAmount: worldArr[4], winloseAmount: worldArr[5] } }
    console.timeEnd('世界地图查询用时')
})

// 统计数值分组
function getSplitList(arr, splitCount) {
    let splitList = [{ start: 0, end: 0 }]
    let max = _.max(arr)
    console.log(max)
    let avg = parseInt(max / splitCount)
    if (avg > 1) {
        for (let i = 0; i < splitCount; i++) {
            if (i < splitCount - 1) {
                splitList.push({ start: avg * i + 1, end: avg * (i + 1) })
            } else {
                splitList.push({ start: avg * i, end: max })
            }
        }
    } else {
        splitList.push({ start: 1, end: max })
    }
    return splitList
}

// sql查询
async function queryGetSql(sqlName, method, inparam, type) {
    let res = await nodebatis.query(sqlName, { method, ...inparam, type })
    let arr = []
    //中国范围
    let chinaData = [
        { name: "北京", value: "0" },
        { name: "天津", value: "0" },
        { name: "上海", value: "0" },
        { name: "重庆", value: "0" },
        { name: "河北", value: "0" },
        { name: "河南", value: "0" },
        { name: "云南", value: "0" },
        { name: "辽宁", value: "0" },
        { name: "黑龙江", value: "0" },
        { name: "湖南", value: "0" },
        { name: "安徽", value: "0" },
        { name: "山东", value: "0" },
        { name: "新疆", value: "0" },
        { name: "江苏", value: "0" },
        { name: "浙江", value: "0" },
        { name: "江西", value: "0" },
        { name: "湖北", value: "0" },
        { name: "广西", value: "0" },
        { name: "甘肃", value: "0" },
        { name: "山西", value: "0" },
        { name: "内蒙古", value: "0" },
        { name: "陕西", value: "0" },
        { name: "吉林", value: "0" },
        { name: "福建", value: "0" },
        { name: "贵州", value: "0" },
        { name: "广东", value: "0" },
        { name: "青海", value: "0" },
        { name: "西藏", value: "0" },
        { name: "四川", value: "0" },
        { name: "宁夏", value: "0" },
        { name: "海南", value: "0" },
        { name: "台湾", value: "0" },
        { name: "香港", value: "0" },
        { name: "澳门", value: "0" }
    ]
    //世界范围
    let worldData = [
        { name: "阿富汗", value: 0 },
        { name: "安哥拉", value: 0 },
        { name: "阿尔巴尼亚", value: 0 },
        { name: "阿拉伯联合酋长国", value: 0 },
        { name: "阿根廷", value: 0 },
        { name: "亚美尼亚", value: 0 },
        { name: "法属南部领地", value: 0 },
        { name: "澳大利亚", value: 0 },
        { name: "奥地利", value: 0 },
        { name: "阿塞拜疆", value: 0 },
        { name: "布隆迪", value: 0 },
        { name: "比利时", value: 0 },
        { name: "贝宁", value: 0 },
        { name: "布基纳法索", value: 0 },
        { name: "孟加拉国", value: 0 },
        { name: "保加利亚", value: 0 },
        { name: "巴哈马", value: 0 },
        { name: "波斯尼亚和黑塞哥维那", value: 0 },
        { name: "白俄罗斯", value: 0 },
        { name: "伯利兹", value: 0 },
        { name: "百慕大群岛", value: 0 },
        { name: "玻利维亚", value: 0 },
        { name: "巴西", value: 0 },
        { name: "文莱", value: 0 },
        { name: "不丹", value: 0 },
        { name: "博茨瓦纳", value: 0 },
        { name: "中非共和国", value: 0 },
        { name: "加拿大", value: 0 },
        { name: "瑞士", value: 0 },
        { name: "智利", value: 0 },
        { name: "中国", value: 0 },
        { name: "象牙海岸", value: 0 },
        { name: "喀麦隆", value: 0 },
        { name: "民主刚果", value: 0 },
        { name: "刚果", value: 0 },
        { name: "哥伦比亚", value: 0 },
        { name: "哥斯达黎加", value: 0 },
        { name: "古巴", value: 0 },
        { name: "北塞浦路斯", value: 0 },
        { name: "塞浦路斯", value: 0 },
        { name: "捷克共和国", value: 0 },
        { name: "德国", value: 0 },
        { name: "吉布提", value: 0 },
        { name: "丹麦", value: 0 },
        { name: "多米尼加共和国", value: 0 },
        { name: "阿尔及利亚", value: 0 },
        { name: "厄瓜多尔", value: 0 },
        { name: "埃及", value: 0 },
        { name: "厄立特里亚", value: 0 },
        { name: "西班牙", value: 0 },
        { name: "爱沙尼亚", value: 0 },
        { name: "埃塞俄比亚", value: 0 },
        { name: "芬兰", value: 0 },
        { name: "斐济", value: 0 },
        { name: "福克兰群岛", value: 0 },
        { name: "法国", value: 0 },
        { name: "加蓬", value: 0 },
        { name: "英国", value: 0 },
        { name: "佐治亚州", value: 0 },
        { name: "迦纳", value: 0 },
        { name: "几内亚", value: 0 },
        { name: "冈比亚", value: 0 },
        { name: "几内亚比绍", value: 0 },
        { name: "赤道几内亚", value: 0 },
        { name: "希腊", value: 0 },
        { name: "格陵兰", value: 0 },
        { name: "危地马拉", value: 0 },
        { name: "法属圭亚那", value: 0 },
        { name: "圭亚那", value: 0 },
        { name: "洪都拉斯", value: 0 },
        { name: "克罗地亚", value: 0 },
        { name: "海地", value: 0 },
        { name: "匈牙利", value: 0 },
        { name: "印度尼西亚", value: 0 },
        { name: "印度", value: 0 },
        { name: "爱尔兰", value: 0 },
        { name: "伊朗", value: 0 },
        { name: "伊拉克", value: 0 },
        { name: "冰岛", value: 0 },
        { name: "以色列", value: 0 },
        { name: "意大利", value: 0 },
        { name: "牙买加", value: 0 },
        { name: "约旦", value: 0 },
        { name: "日本", value: 0 },
        { name: "哈萨克斯坦", value: 0 },
        { name: "肯尼亚", value: 0 },
        { name: "吉尔吉斯斯坦", value: 0 },
        { name: "柬埔寨", value: 0 },
        { name: "韩国", value: 0 },
        { name: "科索沃", value: 0 },
        { name: "科威特", value: 0 },
        { name: "老挝", value: 0 },
        { name: "黎巴嫩", value: 0 },
        { name: "利比里亚", value: 0 },
        { name: "利比亚", value: 0 },
        { name: "斯里兰卡", value: 0 },
        { name: "莱索托", value: 0 },
        { name: "立陶宛", value: 0 },
        { name: "卢森堡", value: 0 },
        { name: "拉脱维亚", value: 0 },
        { name: "摩洛哥", value: 0 },
        { name: "摩尔多瓦", value: 0 },
        { name: "马达加斯加", value: 0 },
        { name: "墨西哥", value: 0 },
        { name: "马其顿", value: 0 },
        { name: "马里", value: 0 },
        { name: "缅甸", value: 0 },
        { name: "黑山", value: 0 },
        { name: "蒙古", value: 0 },
        { name: "莫桑比克", value: 0 },
        { name: "毛里塔尼亚", value: 0 },
        { name: "马拉维", value: 0 },
        { name: "马来西亚", value: 0 },
        { name: "纳米比亚", value: 0 },
        { name: "新喀里多尼亚", value: 0 },
        { name: "尼日尔", value: 0 },
        { name: "尼日利亚", value: 0 },
        { name: "尼加拉瓜", value: 0 },
        { name: "荷兰", value: 0 },
        { name: "挪威", value: 0 },
        { name: "尼泊尔", value: 0 },
        { name: "新西兰", value: 0 },
        { name: "阿曼", value: 0 },
        { name: "巴基斯坦", value: 0 },
        { name: "巴拿马", value: 0 },
        { name: "秘鲁", value: 0 },
        { name: "菲律宾", value: 0 },
        { name: "巴布亚新几内亚", value: 0 },
        { name: "波兰", value: 0 },
        { name: "波多黎各", value: 0 },
        { name: "朝鲜", value: 0 },
        { name: "葡萄牙", value: 0 },
        { name: "巴拉圭", value: 0 },
        { name: "卡塔尔", value: 0 },
        { name: "罗马尼亚", value: 0 },
        { name: "俄罗斯", value: 0 },
        { name: "卢旺达", value: 0 },
        { name: "西撒哈拉", value: 0 },
        { name: "沙特阿拉伯", value: 0 },
        { name: "苏丹", value: 0 },
        { name: "南苏丹", value: 0 },
        { name: "塞内加尔", value: 0 },
        { name: "所罗门群岛", value: 0 },
        { name: "塞拉利昂", value: 0 },
        { name: "萨尔瓦多", value: 0 },
        { name: "索马里兰", value: 0 },
        { name: "索马利亚", value: 0 },
        { name: "塞尔维亚共和国", value: 0 },
        { name: "苏里南", value: 0 },
        { name: "斯洛伐克", value: 0 },
        { name: "斯洛文尼亚", value: 0 },
        { name: "瑞典", value: 0 },
        { name: "斯威士兰", value: 0 },
        { name: "叙利亚", value: 0 },
        { name: "乍得", value: 0 },
        { name: "多哥", value: 0 },
        { name: "泰国", value: 0 },
        { name: "塔吉克斯坦", value: 0 },
        { name: "土库曼斯坦", value: 0 },
        { name: "东帝汶", value: 0 },
        { name: "特立尼达和多巴哥", value: 0 },
        { name: "突尼斯", value: 0 },
        { name: "土耳其", value: 0 },
        { name: "坦桑尼亚联合共和国", value: 0 },
        { name: "乌干达", value: 0 },
        { name: "乌克兰", value: 0 },
        { name: "乌拉圭", value: 0 },
        { name: "美国", value: 0 },
        { name: "乌兹别克斯坦", value: 0 },
        { name: "委内瑞拉", value: 0 },
        { name: "越南", value: 0 },
        { name: "瓦努阿图", value: 0 },
        { name: "约旦河西岸", value: 0 },
        { name: "也门", value: 0 },
        { name: "南非", value: 0 },
        { name: "赞比亚", value: 0 },
        { name: "津巴布韦", value: 0 }
    ]
    let data = inparam.queryFlag == 'province' ? chinaData : worldData
    // 地区名称匹配
    if (res.length > 0) {
        for (let item of res) {
            let index = _.findIndex(data, (o) => {
                return item.province.indexOf(o.name) != -1
            })
            if (index != -1) {
                data[index].value = Math.abs(item.total)
                arr.push(Math.abs(item.total))
            }
        }
    }
    // 分5组数据
    let splitList = getSplitList(arr, 5)
    return [data, splitList]
}

module.exports = router