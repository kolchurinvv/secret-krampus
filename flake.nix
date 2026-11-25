{
  description = "secret-krampus";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          # podman is left to the system: rootless podman needs host
          # configuration a devshell cannot provide.
          packages = with pkgs; [
            bun     # runtime, package manager, test runner
            just    # task runner (see justfile)
            sqlite  # inspect data/krampus.db by hand
            nodejs  # runs the Playwright test runner (as in kolchurin.dev)
          ];

          # e2e: Playwright uses the browsers Nix provides instead of
          # downloading its own. @playwright/test in package.json must stay
          # pinned to the same version as playwright-driver here.
          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_DRIVER_VERSION="${pkgs.playwright-driver.version}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          '';
        };
      });
    };
}
