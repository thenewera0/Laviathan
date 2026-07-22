import os
import sys
import time
import json
import socket
import subprocess
from typing import Dict, List, Optional, Tuple

# Constants
HOST = '0.0.0.0'
PORT = 8000
BUFFER_SIZE = 4096

# Commands
COMMANDS: Dict[str, Tuple[str, str]] = {
    'open_app': ('open', 'Open an application'),
    'search': ('search', 'Search for something'),
    'perform_function': ('perform', 'Perform a function'),
}

def main():
    if len(sys.argv) != 2:
        print('Usage: python leviathan_companion.py <backend_url>')
        sys.exit(1)

    backend_url = sys.argv[1]
    print(f'Connecting to backend at {backend_url}...')

    # Connect to the backend
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((HOST, PORT))
        print('Connected to backend.')

        # Receive the pairing code
        code = s.recv(BUFFER_SIZE).decode('utf-8')
        print(f'Pairing code: {code}')

        # Send the code to the user
        print(f'Tell Leviathan to pair with your computer using the code: {code}')

        # Wait for the user to pair
        while True:
            data = s.recv(BUFFER_SIZE).decode('utf-8')
            if data:
                print(f'Received data: {data}')
                break

        # Process commands
        while True:
            command = input('Enter command: ')
            if command in COMMANDS:
                action, description = COMMANDS[command]
                print(f'Executing {description}...')
                execute_command(action, command)
            else:
                print('Unknown command.')

def execute_command(action: str, command: str) -> None:
    if action == 'open':
        open_app(command)
    elif action == 'search':
        search(command)
    elif action == 'perform':
        perform_function(command)

def open_app(app_name: str) -> None:
    if sys.platform == 'win32':
        subprocess.run(['start', app_name], shell=True)
    elif sys.platform == 'darwin':
        subprocess.run(['open', '-a', app_name], shell=True)
    else:
        print(f'Opening {app_name}...')

def search(query: str) -> None:
    if sys.platform == 'win32':
        subprocess.run(['start', 'ms-edge', f'https://www.google.com/search?q={query}'], shell=True)
    elif sys.platform == 'darwin':
        subprocess.run(['open', '-a', 'Safari', f'https://www.google.com/search?q={query}'], shell=True)
    else:
        print(f'Searching for {query}...')

def perform_function(function_name: str) -> None:
    print(f'Performing function {function_name}...')

if __name__ == '__main__':
    main()