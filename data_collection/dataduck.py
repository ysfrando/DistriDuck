"""
DataDuck Agent

This module is responsible for collecting network data using the Scapy library and sending it to a Kafka cluster.

Components:
- Config: Manages configuration settings loaded from a JSON file.
- DataDuck: Collects network packet data and processes it.
- DuckDelivery: Sends collected data to a Kafka topic.
- Main: Coordinates the data collection and delivery process based on the configuration settings.

Features:
- Collects network packets with specified parameters.
- Sends collected data to a Kafka topic for further processing.
- Handles configuration through a JSON file.
- Logs key actions and errors for monitoring and debugging.

Usage:
1. Ensure Kafka server is running and reachable at the specified address.
2. Create a Kafka Topic to produce and send data to, and consume from as well.
3. Create or modify the configuration file (`dataduck_config.json`) to include:
   - `max_packet_count`: Number of packets to capture per collection interval.
   - `kafka_server`: Address of the Kafka server (default is `localhost:9092`).
   - `collection_interval`: Interval in seconds between data collection cycles (default is 30 seconds).
4. Run the script using Python 3:

   python3 dataduck.py    
   
   
Error Handling:
- Handles exceptions during data collection, Kafka communication, and configuration loading.
- Logs detailed error messages for troubleshooting.

Dependencies:
- Scapy: For network packet capture. (pip3 install scapy)
- Kafka-Python: For interacting with Kafka. (pip3 install kafka-python-ng) Note: I had some issues with the: kafka-python package, however kafka-python-ng worked well

"""


import json
import time
import logging
import scapy.all as scapy
from kafka import KafkaProducer
from typing import Dict, List

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class Config:
    """
    A class to handle configuration file loading and retrieval.

    Attributes:
        file_path (str): Path to the configuration file.
        settings (dict): Configuration settings loaded from the file.
    """

    def __init__(self, file_path: str):
        """
        Initialize the Config object and load settings from the file.

        Args:
            file_path (str): Path to the configuration file.
        """
        self.file_path = file_path
        self.settings = self.load_config()

    def load_config(self) -> Dict:
        """
        Load the configuration from the file.

        Returns:
            dict: Configuration settings.
        
        Raises:
            FileNotFoundError: If the configuration file is not found.
            json.JSONDecodeError: If the configuration file contains invalid JSON.
            
        """
        try:
            with open(self.file_path, 'r') as file:
                config = json.load(file)
        except FileNotFoundError as e:
            logging.error(f'Config file not found: {e}')
            raise
        except json.JSONDecodeError as e:
            logging.error(f'Error decoding JSON from config file: {e}')
            raise
        return config

    def get(self, key: str, default=None):
        """
        Retrieve a configuration value by key.

        Args:
            key (str): The configuration key.
            default: Default value to return if key is not found.

        Returns:
            The configuration value or default value if key is not found.
        """
        return self.settings.get(key, default)


class DataDuck:
    """
    A class to handle network data collection using Scapy.

    Attributes:
        max_packet_count (int): Maximum number of packets to capture.
    """

    def __init__(self, max_packet_count: int):
        """
        Initialize the DataDuck object with packet capture limit.

        Args:
            max_packet_count (int): Maximum number of packets to capture.
        """
        self.max_packet_count = max_packet_count

    def collect_data(self) -> List[Dict]:
        """
        Collect network data using Scapy.

        Returns:
            list: A list of dictionaries containing packet information.
            
        Raises:
            Exception: If there is an error during packet sniffing
        """
        try:
            packets = scapy.sniff(count=self.max_packet_count)
        except Exception as e:
            logging.error(f"Error collecting data: {e}")
            raise
        
        data = []
        for p in packets:
            if scapy.IP in p:
                packet_info = {
                    'src': p[scapy.IP].src,
                    'dst': p[scapy.IP].dst,
                    'length': len(p),
                    'protocol': p[scapy.IP].proto,
                    'src_port': p[scapy.TCP].sport if scapy.TCP in p else None,
                    'dst_port': p[scapy.TCP].dport if scapy.TCP in p else None,
                    'flags': str(p[scapy.TCP].flags) if scapy.TCP in p else '',
                    'ttl': p[scapy.IP].ttl,
                }
                data.append(packet_info)
        return data


class DuckDelivery:
    """
    A class to handle sending collected data to Kafka.

    Attributes:
        producer (KafkaProducer): Kafka producer instance.
    """

    def __init__(self, kafka_server: str):
        """
        Initialize the DuckDelivery object with Kafka server details.

        Args:
            kafka_server (str): Kafka server address.
        """
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=[kafka_server],
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
        except Exception as e:
            logging.error(f"Error initializing Kafka producer: {e}")
            
            
    def send_data(self, data: List[Dict]):
        """
        Send collected data to Kafka.

        Args:
            data (list): List of dictionaries containing packet information.
        """
        try:
            self.producer.send('network_data', data) # 'network_data' is the kafka topic
            self.producer.flush()
            logging.info('Data sent successfully!')
        except Exception as e:
            logging.error(f"Error sending data: {e}")
            raise


class Main:
    """
    The main class to run the DataDuck data collection and sending process.

    Attributes:
        config (Config): Configuration settings.
        collector (DataDuck): Data collection instance.
        sender (DuckDelivery): Data sending instance.
        collection_interval (int): Interval between data collection cycles.
    """

    def __init__(self, config_file: str):
        """
        Initialize the Main object with configuration settings.

        Args:
            config_file (str): Path to the configuration file.
        """
        self.config = Config(config_file)
        self.collector = DataDuck(self.config.get('max_packet_count', 100))
        self.sender = DuckDelivery(self.config.get('kafka_server', 'localhost:9092'))
        self.collection_interval = self.config.get('collection_interval', 30)

    def run(self):
        """
        Start the data collection and sending process.
        """
        logging.info("DistriDuck started.")
        while True:
            try:
                start_time = time.time()
                data = self.collector.collect_data()
                if data:
                    self.sender.send_data(data)
                elapsed_time = time.time() - start_time
                logging.info(f"Data collection and sending took {elapsed_time:.2f} seconds.")
                # Calculate remaining time to sleep
                sleep_time = self.collection_interval - elapsed_time
                if sleep_time > 0:
                    time.sleep(sleep_time)
                else:
                    logging.warning(f"Data collection took longer than the interval: {elapsed_time:.2f} seconds.")
            except Exception as e:
                logging.error(f"An error occurred during processing: {e}")


if __name__ == "__main__":
    try:
        agent = Main('../config/dataduck_config.json')
        agent.run()
    except FileNotFoundError as e:
        logging.error(f'Config file not found: {e}')
    except KeyboardInterrupt:
        logging.info("DistriDuck's job is done here. QuackQuack!!!")