# autounity
Unity package manager for analyzing bleeding-edge package source easily.

## Usage

Running `node autounity` will set up a Unity project in `./autounity` which you can point your Unity editor at. It will also log everything as it sets up the project, and finish with a log describing which packages were installed.

Edit `manifest.json` to pick which packages you want to have installed, and autounity will resolve their dependencies for you.

Use `node autounity -l` if you want to ignore the versions specified by the dependencies and instead just get the latest version of every package needed.

Use `node autounity -r` if you want to regenerate the project. (Note: this will delete `./autounity`) 

Use `node autounity --help` to see all commands.

If a package is not found in the package repository, it gets added to the Unity project manifest because it is most likely an internal unity package.

Note: this project depends on Unity's jfrog bintray instance.

You can also try `dotnet build` to try out WIP unity-as-a-library compilation. (only works for default manifest)
