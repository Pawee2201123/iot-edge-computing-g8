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
            ]))
          ];

          # 2. Tell the FHS to run zsh immediately
          runScript = "zsh";
        };
      in
      {
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
