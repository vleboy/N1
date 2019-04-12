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

//中国范围
const chinaData = [
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


//全球范围
const worldData = [
    { name: "阿富汗", value: 28397.812 },
    { name: "安哥拉", value: 19549.124 },
    { name: "阿尔巴尼亚", value: 3150.143 },
    { name: "阿拉伯联合酋长国", value: 8441.537 },
    { name: "阿根廷", value: 40374.224 },
    { name: "亚美尼亚", value: 2963.496 },
    { name: "法属南部领地", value: 268.065 },
    { name: "澳大利亚", value: 22404.488 },
    { name: "奥地利", value: 8401.924 },
    { name: "阿塞拜疆", value: 9094.718 },
    { name: "布隆迪", value: 9232.753 },
    { name: "比利时", value: 10941.288 },
    { name: "贝宁", value: 9509.798 },
    { name: "布基纳法索", value: 15540.284 },
    { name: "孟加拉国", value: 151125.475 },
    { name: "保加利亚", value: 7389.175 },
    { name: "巴哈马", value: 66402.316 },
    { name: "波斯尼亚和黑塞哥维那", value: 3845.929 },
    { name: "白俄罗斯", value: 9491.07 },
    { name: "伯利兹", value: 308.595 },
    { name: "百慕大群岛", value: 64.951 },
    { name: "玻利维亚", value: 716.939 },
    { name: "巴西", value: 195210.154 },
    { name: "文莱", value: 27.223 },
    { name: "不丹", value: 716.939 },
    { name: "博茨瓦纳", value: 1969.341 },
    { name: "中非共和国", value: 4349.921 },
    { name: "加拿大", value: 34126.24 },
    { name: "瑞士", value: 7830.534 },
    { name: "智利", value: 17150.76 },
    { name: "中国", value: 1359821.465 },
    { name: "象牙海岸", value: 60508.978 },
    { name: "喀麦隆", value: 20624.343 },
    { name: "民主刚果", value: 62191.161 },
    { name: "刚果", value: 3573.024 },
    { name: "哥伦比亚", value: 46444.798 },
    { name: "哥斯达黎加", value: 4669.685 },
    { name: "古巴", value: 11281.768 },
    { name: "北塞浦路斯", value: 1.468 },
    { name: "塞浦路斯", value: 1103.685 },
    { name: "捷克共和国", value: 10553.701 },
    { name: "德国", value: 83017.404 },
    { name: "吉布提", value: 834.036 },
    { name: "丹麦", value: 5550.959 },
    { name: "多米尼加共和国", value: 10016.797 },
    { name: "阿尔及利亚", value: 37062.82 },
    { name: "厄瓜多尔", value: 15001.072 },
    { name: "埃及", value: 78075.705 },
    { name: "厄立特里亚", value: 5741.159 },
    { name: "西班牙", value: 46182.038 },
    { name: "爱沙尼亚", value: 1298.533 },
    { name: "埃塞俄比亚", value: 87095.281 },
    { name: "芬兰", value: 5367.693 },
    { name: "斐济", value: 860.559 },
    { name: "福克兰群岛", value: 49.581 },
    { name: "法国", value: 63230.866 },
    { name: "加蓬", value: 1556.222 },
    { name: "英国", value: 62066.35 },
    { name: "佐治亚州", value: 4388.674 },
    { name: "迦纳", value: 24262.901 },
    { name: "几内亚", value: 10876.033 },
    { name: "冈比亚", value: 1680.64 },
    { name: "几内亚比绍", value: 10876.033 },
    { name: "赤道几内亚", value: 696.167 },
    { name: "希腊", value: 11109.999 },
    { name: "格陵兰", value: 56.546 },
    { name: "危地马拉", value: 14341.576 },
    { name: "法属圭亚那", value: 231.169 },
    { name: "圭亚那", value: 786.126 },
    { name: "洪都拉斯", value: 7621.204 },
    { name: "克罗地亚", value: 4338.027 },
    { name: "海地", value: 9896.4 },
    { name: "匈牙利", value: 10014.633 },
    { name: "印度尼西亚", value: 240676.485 },
    { name: "印度", value: 1205624.648 },
    { name: "爱尔兰", value: 4467.561 },
    { name: "伊朗", value: 240676.485 },
    { name: "伊拉克", value: 30962.38 },
    { name: "冰岛", value: 318.042 },
    { name: "以色列", value: 7420.368 },
    { name: "意大利", value: 60508.978 },
    { name: "牙买加", value: 2741.485 },
    { name: "约旦", value: 6454.554 },
    { name: "日本", value: 127352.833 },
    { name: "哈萨克斯坦", value: 15921.127 },
    { name: "肯尼亚", value: 40909.194 },
    { name: "吉尔吉斯斯坦", value: 5334.223 },
    { name: "柬埔寨", value: 14364.931 },
    { name: "韩国", value: 51452.352 },
    { name: "科索沃", value: 97.743 },
    { name: "科威特", value: 2991.58 },
    { name: "老挝", value: 6395.713 },
    { name: "黎巴嫩", value: 4341.092 },
    { name: "利比里亚", value: 3957.99 },
    { name: "利比亚", value: 6040.612 },
    { name: "斯里兰卡", value: 20758.779 },
    { name: "莱索托", value: 2008.921 },
    { name: "立陶宛", value: 3068.457 },
    { name: "卢森堡", value: 507.885 },
    { name: "拉脱维亚", value: 2090.519 },
    { name: "摩洛哥", value: 31642.36 },
    { name: "摩尔多瓦", value: 103.619 },
    { name: "马达加斯加", value: 21079.532 },
    { name: "墨西哥", value: 117886.404 },
    { name: "马其顿", value: 507.885 },
    { name: "马里", value: 13985.961 },
    { name: "缅甸", value: 51931.231 },
    { name: "黑山", value: 620.078 },
    { name: "蒙古", value: 2712.738 },
    { name: "莫桑比克", value: 23967.265 },
    { name: "毛里塔尼亚", value: 3609.42 },
    { name: "马拉维", value: 15013.694 },
    { name: "马来西亚", value: 28275.835 },
    { name: "纳米比亚", value: 2178.967 },
    { name: "新喀里多尼亚", value: 246.379 },
    { name: "尼日尔", value: 15893.746 },
    { name: "尼日利亚", value: 159707.78 },
    { name: "尼加拉瓜", value: 5822.209 },
    { name: "荷兰", value: 16615.243 },
    { name: "挪威", value: 4891.251 },
    { name: "尼泊尔", value: 26846.016 },
    { name: "新西兰", value: 4368.136 },
    { name: "阿曼", value: 2802.768 },
    { name: "巴基斯坦", value: 173149.306 },
    { name: "巴拿马", value: 3678.128 },
    { name: "秘鲁", value: 29262.83 },
    { name: "菲律宾", value: 93444.322 },
    { name: "巴布亚新几内亚", value: 6858.945 },
    { name: "波兰", value: 38198.754 },
    { name: "波多黎各", value: 3709.671 },
    { name: "朝鲜", value: 1.468 },
    { name: "葡萄牙", value: 10589.792 },
    { name: "巴拉圭", value: 6459.721 },
    { name: "卡塔尔", value: 1749.713 },
    { name: "罗马尼亚", value: 21861.476 },
    { name: "俄罗斯", value: 21861.476 },
    { name: "卢旺达", value: 10836.732 },
    { name: "西撒哈拉", value: 514.648 },
    { name: "沙特阿拉伯", value: 27258.387 },
    { name: "苏丹", value: 35652.002 },
    { name: "南苏丹", value: 9940.929 },
    { name: "塞内加尔", value: 12950.564 },
    { name: "所罗门群岛", value: 526.447 },
    { name: "塞拉利昂", value: 5751.976 },
    { name: "萨尔瓦多", value: 6218.195 },
    { name: "索马里兰", value: 9636.173 },
    { name: "索马利亚", value: 9636.173 },
    { name: "塞尔维亚共和国", value: 3573.024 },
    { name: "苏里南", value: 524.96 },
    { name: "斯洛伐克", value: 5433.437 },
    { name: "斯洛文尼亚", value: 2054.232 },
    { name: "瑞典", value: 9382.297 },
    { name: "斯威士兰", value: 1193.148 },
    { name: "叙利亚", value: 7830.534 },
    { name: "乍得", value: 11720.781 },
    { name: "多哥", value: 6306.014 },
    { name: "泰国", value: 66402.316 },
    { name: "塔吉克斯坦", value: 7627.326 },
    { name: "土库曼斯坦", value: 5041.995 },
    { name: "东帝汶", value: 10016.797 },
    { name: "特立尼达和多巴哥", value: 1328.095 },
    { name: "突尼斯", value: 10631.83 },
    { name: "土耳其", value: 72137.546 },
    { name: "坦桑尼亚联合共和国", value: 44973.33 },
    { name: "乌干达", value: 33987.213 },
    { name: "乌克兰", value: 46050.22 },
    { name: "乌拉圭", value: 3371.982 },
    { name: "美利坚合众国", value: 312247.116 },
    { name: "乌兹别克斯坦", value: 27769.27 },
    { name: "委内瑞拉", value: 236.299 },
    { name: "越南", value: 89047.397 },
    { name: "瓦努阿图", value: 236.299 },
    { name: "约旦河西岸", value: 13.565 },
    { name: "也门", value: 22763.008 },
    { name: "南非", value: 51452.352 },
    { name: "赞比亚", value: 13216.985 },
    { name: "津巴布韦", value: 13076.978 }
]



/**
 * 中国地图统计
 */
router.get('/map/china', async (ctx, next) => {
    let inparam = ctx.request.query
    let res = await nodebatis.query('bill.chinaCount', { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    if (res.length > 0) {
        for (let item of res) {
            let index = _.findIndex(chinaData, function (o) {
                return item.province.indexOf(o.name) != -1
            })
            if (index != -1) {
                chinaData[index].value = item.total
            }
        }
    }
    ctx.body = { code: 0, data: chinaData }
})

/**
 * 中国地图统计
 */
router.get('/map/world', async (ctx, next) => {
    let inparam = ctx.request.query
    let res = await nodebatis.query('bill.worldCount', { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    if (res.length > 0) {
        for (let item of res) {
            let index = _.findIndex(worldData, function (o) {
                return item.province.indexOf(o.name) != -1
            })
            if (index != -1) {
                worldData[index].value = item.total
            }
        }
    }
    ctx.body = { code: 0, data: worldData }
})

module.exports = router