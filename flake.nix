{
  description = "M5Stack PlatformIO Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        fhs = pkgs.buildFHSEnv {
          name = "pio-shell";
          
          # 1. Add zsh and your favorite tools here so they exist inside the bubble
          targetPkgs = pkgs: with pkgs; [
            platformio
            nodejs
            git
            
            # Communication & API Tools
            mosquitto
            postgresql  # Database for IoT data persistence

            # Shell Ergonomics
            #zsh
            #starship  # Optional: if you use Starship prompt
            #fzf       # Optional: for fuzzy finding history
            
            # System Libs
            ncurses
            libusb1
            zlib
            udev

            (python3.withPackages (ps: [
                                   ps.paho-mqtt
                                   ps.flask            # Web Server
                                   ps.flask-socketio   # WebSockets
                                   ps.eventlet         # Async networking
                                   ps.psycopg2         # PostgreSQL adapter
                                   ps.python-dotenv    # Environment variable management
            ]))
          ];

          # 2. Tell the FHS to run zsh immediately
          runScript = "zsh";
        };
        # Python application for Flask server
        pythonApp = pkgs.python3.withPackages (ps: with ps; [
          flask
          flask-socketio
          paho-mqtt
          eventlet
          psycopg2
          python-dotenv
        ]);

        # Startup script for Flask server
        startScript = pkgs.writeScriptBin "start-server" ''
          #!${pkgs.bash}/bin/bash
          set -e

          echo "🚀 Starting IoT Elder Care Server..."

          # Set environment variables
          export DB_HOST=''${DB_HOST:-postgres}
          export DB_PORT=''${DB_PORT:-5432}
          export DB_NAME=''${DB_NAME:-edgedevices}
          export DB_USER=''${DB_USER:-iot_user}
          export DB_PASSWORD=''${DB_PASSWORD:-iot_pass_2026}
          export MQTT_BROKER=''${MQTT_BROKER:-mosquitto}

          # Wait for PostgreSQL to be ready
          echo "⏳ Waiting for PostgreSQL..."
          until ${pkgs.postgresql}/bin/pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; do
            sleep 1
          done
          echo "✅ PostgreSQL is ready"

          # Initialize database schema if needed
          echo "📊 Initializing database schema..."
          PGPASSWORD=$DB_PASSWORD ${pkgs.postgresql}/bin/psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f /app/schema.sql || echo "Schema already initialized"

          # Start Flask server
          cd /app
          exec ${pythonApp}/bin/python app.py
        '';

      in
      {
        # Docker image for Flask server
        packages.dockerImage = pkgs.dockerTools.buildLayeredImage {
          name = "iot-flask-server";
          tag = "latest";

          contents = [
            pythonApp
            pkgs.postgresql
            pkgs.bash
            pkgs.coreutils
            startScript
          ];

          config = {
            Cmd = [ "${startScript}/bin/start-server" ];
            ExposedPorts = {
              "8000/tcp" = {};
            };
            Env = [
              "PYTHONUNBUFFERED=1"
              "LC_ALL=C.UTF-8"
              "LANG=C.UTF-8"
            ];
            WorkingDir = "/app";
          };

          # Copy application files into the image
          extraCommands = ''
            mkdir -p app
            cp ${./server/app.py} app/app.py
            cp ${./server/db_config.py} app/db_config.py
            cp ${./server/schema.sql} app/schema.sql
            cp ${./server/requirements.txt} app/requirements.txt

            # Copy templates
            mkdir -p app/templates
            cp ${./server/templates/index.html} app/templates/index.html

            # Copy static files
            mkdir -p app/static
            cp ${./server/static/app.js} app/static/app.js
            cp ${./server/static/style.css} app/static/style.css
          '';
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [ fhs ];

          # 3. Your Auto-Launch Logic
          shellHook = ''
# Check if we are already inside the FHS to prevent loops
                  if [ -z "$IN_NIX_SHELL_IMPURE" ]; then
                    echo "🚀 Auto-launching PlatformIO FHS environment (Zsh)..."

# Set the flag so the inner shell knows it's the inner shell
                      export IN_NIX_SHELL_IMPURE=1

# Replace the current bash process with the FHS zsh process
                      exec pio-shell
                      fi

# This part runs ONLY inside the inner Zsh
                      echo "✅ You are now in the FHS Zsh."
                      '';
        };
      }
      );
}
