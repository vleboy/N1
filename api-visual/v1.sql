-- Adminer 4.7.1 MySQL dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

CREATE DATABASE `v1` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */;
USE `v1`;

DROP TABLE IF EXISTS `bill`;
CREATE TABLE `bill` (
  `sn` varchar(50) NOT NULL,
  `businessKey` int(50) NOT NULL,
  `parent` varchar(36) NOT NULL,
  `userId` int(11) NOT NULL,
  `userName` varchar(20) NOT NULL,
  `gameType` int(11) NOT NULL,
  `gameId` int(11) NOT NULL,
  `type` int(11) NOT NULL,
  `originalAmount` double NOT NULL,
  `amount` double NOT NULL,
  `balance` double NOT NULL,
  `sourceIP` varchar(128) NOT NULL,
  `createdAt` timestamp NOT NULL,
  PRIMARY KEY (`sn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- 2019-04-08 08:51:32
