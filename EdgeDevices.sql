-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: EdgeDevices
-- ------------------------------------------------------
-- Server version       8.0.44-0ubuntu0.24.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Accel`
--

DROP TABLE IF EXISTS `Accel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Accel` (
  `time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `x` decimal(10,2) NOT NULL,
  `y` decimal(10,2) NOT NULL,
  `z` decimal(10,2) NOT NULL,
  `comp` decimal(10,2) NOT NULL,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Accel`
--

LOCK TABLES `Accel` WRITE;
/*!40000 ALTER TABLE `Accel` DISABLE KEYS */;
/*!40000 ALTER TABLE `Accel` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Commu`
--

DROP TABLE IF EXISTS `Commu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Commu` (
  `time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `emerg` tinyint(1) DEFAULT NULL,
  `msg` text,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Commu`
--

LOCK TABLES `Commu` WRITE;
/*!40000 ALTER TABLE `Commu` DISABLE KEYS */;
/*!40000 ALTER TABLE `Commu` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Heat`
--

DROP TABLE IF EXISTS `Heat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Heat` (
  `time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `temp` decimal(10,2) NOT NULL,
  `hum` decimal(10,2) NOT NULL,
  `wbgt` decimal(10,2) NOT NULL,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Heat`
--

LOCK TABLES `Heat` WRITE;
/*!40000 ALTER TABLE `Heat` DISABLE KEYS */;
/*!40000 ALTER TABLE `Heat` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-09 14:48:43