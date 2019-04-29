const GameTypeEnum = {
    '10000': { type: 4, code: '10000', name: 'NA棋牌游戏', company: 'NA' },
    '30000': { type: 1, code: '30000', name: 'NA真人视讯', company: 'NA' },
    '40000': { type: 2, code: '40000', name: 'NA电子游戏', company: 'NA' },
    '50000': { type: 3, code: '50000', name: 'NA街机游戏', company: 'NA' },
    '60000': { type: 6, code: '60000', name: 'NA捕鱼游戏', company: 'NA' },
    '70000': { type: 2, code: '70000', name: 'H5电子游戏', company: 'NA' },
    '80000': { type: 1, code: '80000', name: 'H5真人视讯', company: 'NA' },
    '90000': { type: 1, code: '90000', name: 'H5电子游戏-无神秘奖', company: 'NA' },
    '1010000': { type: 2, code: '1010000', name: 'TTG电子游戏', company: 'TTG' },
    '1020000': { type: 2, code: '1020000', name: 'PNG电子游戏', company: 'PNG' },
    '10300000': { type: 2, code: '10300000', name: 'MG电子游戏', company: 'MG' },
    '1040000': { type: 2, code: '1040000', name: 'HABA电子游戏', company: 'HABA' },
    '1050000': { type: 1, code: '1050000', name: 'AG真人游戏', company: 'AG' },
    '1060000': { type: 1, code: '1060000', name: 'SA真人游戏', company: 'SA' },
    '1070000': { type: 4, code: '1070000', name: 'KY棋牌游戏', company: 'KY' },
    '1080000': { type: 2, code: '1080000', name: 'SB电子游戏', company: 'SB' },
    '1090000': { type: 2, code: '1090000', name: 'PG电子游戏', company: 'PG' },
    // '1100000': { type: 5, code: '1100000', name: 'UG体育游戏', company: 'UG' },
    '1110000': { type: 6, code: '1110000', name: 'SA捕鱼游戏', company: 'SA' },
    '1120000': { type: 1, code: '1120000', name: 'SB真人游戏', company: 'SB' },
    '1130000': { type: 5, code: '1130000', name: 'YSB体育游戏', company: 'YSB' },
    '1140000': { type: 2, code: '1140000', name: 'RTG电子游戏', company: 'RTG' },
    '1150000': { type: 2, code: '1150000', name: 'DT电子游戏', company: 'DT' },
    '1160000': { type: 2, code: '1160000', name: 'PP电子游戏', company: 'PP' },
}
const GameListEnum = {
    "NA": [
        // { company: 'NA', code: '3', name: 'NA商城' },
        { company: 'NA', code: '10000', name: 'NA棋牌游戏'},
        { company: 'NA', code: '30000', name: 'NA真人视讯' },
        { company: 'NA', code: '40000', name: 'NA电子游戏' },
        { company: 'NA', code: '50000', name: 'NA街机游戏' },
        { company: 'NA', code: '60000', name: 'NA捕鱼游戏' },
        { company: 'NA', code: '70000', name: 'H5电子游戏' },
        { company: 'NA', code: '80000', name: 'H5真人视讯' },
        { company: 'NA', code: '90000', name: 'H5电子游戏-无神秘奖' }
    ],
    "TTG": [
        { company: 'TTG', code: '1010000', name: 'TTG电子游戏' }
    ],
    "PNG": [
        { company: 'PNG', code: '1020000', name: 'PNG电子游戏' },
    ],
    "MG": [
        { company: 'MG', code: '10300000', name: 'MG电子游戏' }
    ],
    "HABA": [
        { company: 'HABA', code: '1040000', name: 'HABA电子游戏' },
    ],
    "AG": [
        { company: 'AG', code: '1050000', name: 'AG真人游戏' }
    ],
    "SA": [
        { company: 'SA', code: '1060000', name: 'SA真人游戏' },
        { company: 'SA', code: '1110000', name: 'SA捕鱼游戏' }
    ],
    "KY": [
        { company: 'KY', code: '1070000', name: 'KY棋牌游戏' }
    ],
    "PG": [
        { company: 'PG', code: '1090000', name: 'PG电子游戏' }
    ],
    "YSB": [
        { company: 'YSB', code: '1130000', name: 'YSB体育游戏' }
    ],
    "RTG": [
        { company: 'RTG', code: '1140000', name: 'RTG电子游戏' }
    ],
    "SB": [
        { company: 'SB', code: '1080000', name: 'SB电子游戏' },
        { company: 'SB', code: '1120000', name: 'SB真人游戏' }
    ],
    "DT": [
        { company: 'DT', code: '1150000', name: 'DT电子游戏' },
    ],
    "PP": [
        { company: 'PP', code: '1160000', name: 'PP电子游戏' },
    ]
}
/**
 * 游戏公司枚举
 */
const companyEnum = [
    { companyIden: 'AG', companyName: 'Ag' },
    { companyIden: 'DT', companyName: 'DT' },
    { companyIden: 'HABA', companyName: 'HABA' },
    { companyIden: 'MG', companyName: 'MG' },
    { companyIden: 'NA', companyName: 'NA' },
    { companyIden: 'PG', companyName: 'PG' },
    { companyIden: 'PNG', companyName: 'PNG' },
    { companyIden: 'PP', companyName: 'PP' },
    { companyIden: 'RTG', companyName: 'RTG' },
    { companyIden: 'SA', companyName: 'SA' },
    { companyIden: 'SB', companyName: 'SB' },
    { companyIden: 'TTG', companyName: 'TTG' },
    { companyIden: 'YSB', companyName: 'YSB' }
]



module.exports = {
    GameTypeEnum,
    GameListEnum,
    companyEnum
}