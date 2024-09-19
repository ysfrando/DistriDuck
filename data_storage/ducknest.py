"""
DuckNest: Kafka to SQLite Data Ingestion Server

Description:
    DuckNest is a Flask-based server application designed to consume data from a Kafka topic and store it in an SQLite database. It provides a RESTful API endpoint to retrieve stored data and runs a background thread to continuously consume and process messages from Kafka.

Key Features:
    - Consumes data from a specified Kafka topic.
    - Stores the consumed data into an SQLite database.
    - Provides an API endpoint to retrieve stored data.
    - Handles errors and logs important events for monitoring and debugging.

Components:
    - DuckNest Class: Core server class responsible for initializing the application, setting up routes, and managing Kafka consumption and database operations.
    - init_db Method: Initializes the SQLite database and creates the necessary tables if they do not exist.
    - store_data Method: Stores consumed Kafka data into the SQLite database.
    - setup_routes Method: Defines the API routes for retrieving data from the database.
    - start_kafka_consumer Method: Starts a background thread to consume Kafka messages and process them.
    - run Method: Runs the Flask application server.

Usage:
    1. Configure Kafka server address and topic as needed.
    2. Initialize and run the DuckNest server.
    3. Access the API endpoint `/data` to retrieve the stored network data.

Dependencies:
    - Flask: Web framework for building the API server.
    - sqlite3: SQLite database library for data storage.
    - kafka-python: Kafka client for consuming messages from Kafka.
    - threading: To run the Kafka consumer in a separate thread.
    - json: For JSON data handling and processing.

Example:
    To run the server with default settings, execute the script directly:
        python ducknest.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS  # You'll need to install this: pip install flask-cors
import logging
import sqlite3
from kafka import KafkaConsumer
import threading
import json

class DuckNest:
    """
    DuckNest is a Flask-based server that consumes data from a Kafka topic and stores it in an SQLite database.
    
    Attributes:
        db_path (str): Path to the SQLite database file.
        kafka_server (str): Address of the Kafka server.
        topic (str): Kafka topic from which to consume data.
        app (Flask): Flask application instance.
    """
    
    def __init__(self, db_path='data.db', kafka_server='localhost:9092', topic='network_data'):
        """
        Initializes the DuckNest server with the given configuration.

        Args:
            db_path (str): Path to the SQLite database file. Defaults to 'data.db'.
            kafka_server (str): Address of the Kafka server. Defaults to 'localhost:9092'.
            topic (str): Kafka topic to consume data from. Defaults to 'network_data'.
        """
        self.db_path = db_path
        self.kafka_server = kafka_server
        self.topic = topic
        self.app = Flask(__name__)
        CORS(self.app)  # This enables CORS for all routes
        self.setup_routes()
        self.init_db()
        self.start_kafka_consumer()
        
    
    def init_db(self):
        """
        Initializes the SQLite database and creates the necessary table with the updated schema.
        Drops the table if it already exists and recreates it.
        Logs success or failure of the operation.
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            # cursor.execute('DROP TABLE IF EXISTS network_data')
            # Create the new table with the updated schema
            cursor.execute('''
                CREATE TABLE network_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    src TEXT NOT NULL,
                    dst TEXT NOT NULL,
                    length INT NOT NULL,
                    protocol INT,
                    src_port INT,
                    dst_port INT,
                    flags TEXT DEFAULT '',
                    ttl INT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
            conn.close()
            logging.info('Database initialized successfully.')
        except sqlite3.Error as e:
            logging.error(f"Database initialization error: {e}")
    
    
    def store_data(self, data):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.executemany(
                'INSERT INTO network_data (src, dst, length, protocol, src_port, dst_port, flags, ttl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [(item['src'], item['dst'], item['length'], item['protocol'], item['src_port'] if item['src_port'] is not None else 0, 
                  item['dst_port'] if item['dst_port'] is not None else 0, item['flags'] if item['flags'] is not None else '', item['ttl'] if item['ttl'] is not None else 0) 
                 for item in data]
            )
            conn.commit()
            conn.close()
            logging.info("Data stored successfully")
        except sqlite3.Error as e:
            logging.error(f"Error storing data: {e}")
            
        
    def setup_routes(self):
        """
        Sets up the routes for the Flask application.
        Includes a route for retrieving data from the database.
        """
        
        @self.app.route('/data', methods=['GET'])
        def get_data():
            """
            Endpoint to retrieve all data from the database.

            Returns:
                Response: A JSON response containing the data or an error message.
            """
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM network_data')
                rows = cursor.fetchall()
                conn.close()
                return jsonify({'status': 'success', 'data': rows}), 200, {'Content-Type': 'application/json'}
            except sqlite3.Error as e:
                logging.error(f"Error fetching data: {e}")
                return jsonify({'status': 'fail', 'message': 'Error fetching data'}), 500, {'Content-Type': 'application/json'}
        
    def start_kafka_consumer(self):
        """
        Starts a separate thread to consume messages from Kafka and store them in the database.
        Handles errors that occur during message consumption.
        """
        def consume():
            """
            Consumes messages from the Kafka topic and stores them in the database.
            """
            try:
                consumer = KafkaConsumer(
                    self.topic,
                    bootstrap_servers=[self.kafka_server],
                    group_id='ducknest-group',
                    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
                )
                for message in consumer:
                    data = message.value
                    if data:
                        self.store_data(data)
                        logging.info(f'Consumed data from Kafka: {data}')
            except Exception as e:
                logging.error(f"Unexpected error in Kafka consumer: {e}")
                
        kafka_thread = threading.Thread(target=consume, daemon=True)
        kafka_thread.start()
    
    def run(self, host='0.0.0.0', port=9001):
        """
        Runs the Flask application.

        Args:
            host (str): The host address to bind the server to. Defaults to '0.0.0.0'.
            port (int): The port number to bind the server to. Defaults to 9001.
        """
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        try:
            self.app.run(host=host, port=port)
        except Exception as e:
            logging.error(f"Error starting Flask server: {e}")
        
        
if __name__ == '__main__':
    """
    Entry point for the DuckNest server. Initializes and runs the server.
    Handles exceptions for configuration file errors and server interruptions.
    """
    try:
        server = DuckNest()
        server.run()
    except FileNotFoundError as e:
        logging.error(f'Config file not found: {e}')
    except KeyboardInterrupt:
        logging.info("DuckNest server interrupted. Shutting down.")
    except Exception as e:
        logging.error(f"Unexpected error: {e}")