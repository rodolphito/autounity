const fs = require("fs");
const tar = require('tar-fs');
const gunzip = require('gunzip-maybe');
const cmdargs = require("minimist");
const request = require("request");
const rimraf = require("rimraf");

function ensure_dir(path) {
	if (!fs.existsSync(path)) fs.mkdirSync(path);
}

function get_json(path) {
	return JSON.parse(fs.readFileSync(path));
}

function set_json(path, file, contents) {
	if (typeof contents !== "string") contents = JSON.stringify(contents);
	ensure_dir(path);
	fs.writeFileSync(path + file, contents);
}

function get_package(registry, assets, package, version) {
	console.log(`Checking for ${package}@${version}.`);
	if (registry[package])
	{
		if (registry[package].version === version)
		{
			console.log(`Found ${package}@${version} in cache.`);
			return false;
		}
		console.log(`Found ${package}@${registry[package].version} in cache, but ${package}@${version} is required.`);
		if (registry[package].version)
		{
			console.log(`Proceeding with cached ${package}@${registry[package].version}. (Required: ${package}@${version})`);
			return registry[package];
		}
	}
	const path = `${assets}${package}/package/package.json`;
	if (!fs.existsSync(path))
	{
		console.log(`Could not locate an existing install of ${package}@${version}.`);
		return false;
	}
	const descriptor = get_json(path);
	if (descriptor.version !== version)
	{
		console.log(`Version mismatch. Installed: ${package}@${descriptor.version} Required: ${package}@${version}`);
		if (!descriptor.version) return false;
		console.log(`Proceeding with ${package}@${descriptor.version}. (Required: ${package}@${version})`);
	}
	console.log(`Found ${package}@${descriptor.version}.`);
	registry[package] = descriptor;
	return descriptor;
}

async function resolve_version(repository, package, version) {
	console.log(`Resolving ${package}@${version}.`);
	const options = {
		uri: `${repository}${package}/${version}`,
		timeout: 2000,
		followAllRedirects: true
	};

	return await new Promise((resolve, reject) => {
		request(options, function(error, response, body) {
			const uri = response.request.uri.href;
			const parts = uri.split('/');
			if (error) resolve(false);
			if (response.statusCode !== 200) resolve(false);
			const resolved_version = parts[parts.length - 1];
			console.log(`Resolved ${package}@${version} to ${package}@${resolved_version}.`);
			resolve(resolved_version);
		})
	});
}

async function install(repository, assets, package, version) {
	console.log(`Installing ${package}@${version}.`);

	const package_uri = `${repository}download_file?file_path=${package}%2F-%2F${package}-${version}.tgz`;

	await new Promise(fulfill => request
		.get(package_uri)
		.pipe(gunzip())
		.pipe(tar.extract(`${assets}${package}`))
		.on("finish", fulfill)
	);
}

async function setup(repository, assets, registry, manifest, ignore, dependencies, latest) {
	await Promise.all(Object.keys(dependencies).map(async function(package) {
		if (ignore[package])
		{
			console.log(`Skipping ${package} because it is marked 'ignore'.`);
			return;
		}
		const version = await resolve_version(repository, package, latest ? "_latestVersion" : dependencies[package]);
		if (!version)
		{
			console.log(`Adding ${package}@${dependencies[package]} to manifest.json because it doesn't exist in the registry.`);
			if (manifest.dependencies[package] === dependencies[package])
			{
				console.log(`${package}@${manifest.dependencies[package]} is already in the manifest.json.`);
			}
			else if (manifest.dependencies[package])
			{
				console.log(`Preserving ${package}@${manifest.dependencies[package]} in the manifest.json, even though ${package}@${dependencies[package]} is required.`);
				return;
			}
			manifest.dependencies[package] = dependencies[package];
			return;
		}
		var descriptor = get_package(registry, assets, package, version);
		if (!descriptor)
		{
			await install(repository, assets, package, version);
			descriptor = get_package(registry, assets, package, version);
		}
		if (descriptor.dependencies)
		{
			await setup(repository, assets, registry, manifest, ignore, descriptor.dependencies, latest);
		}
	}));
}

function print_help()
{
	console.log(`usage: node autounity
	-r (--replace)
		overwrites any existing project.
	-l (--latest)
		forces the latest version of each package needed to be used, as opposed to downloading the requested version.
	--name project_name
		sets the name of the generated unity project. Defaults to "autounity".
	--repository package_repo
		sets the package repository to fetch from, overrides -c and -s. Defaults to "https://bintray.com/unity/unity-staging/".
	--company company_name
		sets the company to use, defaults to "unity".
	--stage stage
		sets the stage to use, defaults to "unity-staging".
	`);
}

async function main(args)
{
	if (args.help || args.h)
	{
		print_help();
		return;
	}

	const stage = args.stage || "unity-staging";
	const company = args.company || "unity";
	const repository = args.repository || `https://bintray.com/${company}/${stage}/`;
	const name = args.name || "autounity";
	const project = `./${name}/`;
	const assets = `${project}Assets/`;

	if (fs.existsSync(project))
	{
		if (args.replace || args.r)
		{
			console.log(`Replacing existing project...`);
			rimraf.sync(project);
		}
		else
		{
			console.log(`Project already exists. Use --replace to overwrite it.`);
			return;
		}
	}
	fs.mkdirSync(project);

	console.log(`Creating assembly definition...`);
	console.log(``);
	const asmdef = {};
	asmdef.name = "autounity";
	asmdef.allowUnsafeCode = true;
	set_json(assets, "autounity.asmdef", asmdef);

	console.log(`Reading project manifest...`);
	console.log(``);
	const m = get_json("manifest.json");

	console.log(`Setting up unity packages...`);
	console.log(``);

	const ignore = {};
	const registry = {};
	const manifest = {"dependencies":{}};
	if (m.ignore) m.ignore.forEach(package => ignore[package] = true);

	await setup(repository, assets, registry, manifest, ignore, m.dependencies, args.latest || args.l);

	console.log(`Writing out unity project manifest...`);
	console.log(``);
	set_json(`${project}Packages/`, "manifest.json", manifest);

	set_json(`${project}ProjectSettings/`, "ProjectVersion.txt", "m_EditorVersion: 2019.3.0a2\n");

	console.log(`Successfully verified a project setup with the following packages:`);
	console.log(``);
	console.log(Object.values(registry).map(package => `${package.name}@${package.version} (${package.unity})`));
}

main(cmdargs(process.argv.slice(2)));
