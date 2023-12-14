const readline = require('readline');
const path = require('path');

class FileSystemObject {
    constructor(name) {
        this.name = name;
    }

    display() {
        throw new Error('display method must be implemented by subclasses');
    }
}

class File extends FileSystemObject {
    constructor(name, content = '') {
        super(name);
        this.content = content;
    }

    display() {
        console.log(`File: ${this.name}`);
    }

    getContent() {
        return this.content;
    }

    setContent(newContent) {
        this.content = newContent;
    }

    setParentDirectory(parent) {
        this.parentDirectory = parent;
    }
}

class Directory extends FileSystemObject {
    constructor(name) {
        super(name);
        this.contents = [];
    }

    addFile(fileName, content = '') {
        this.contents.push(new File(fileName, content));
    }

    addDirectory(dirName) {
        const newDir = new Directory(dirName);
        newDir.setParentDirectory(this);
        this.contents.push(newDir);
    }

    listContents() {
        this.contents.forEach(item => console.log(item.name));
    }

    findObject(objectName) {
        if (objectName === '..') {
            return this.parentDirectory;
        }

        return this.contents.find(item => item.name === objectName);
    }

    setParentDirectory(parent) {
        this.parentDirectory = parent;
    }
}

class Terminal {
    constructor() {
        this.currentDirectory = new Directory('root');
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    start() {
        console.log('Welcome to the Terminal! Type "exit" to quit.');
        this.run();
    }

    run() {
        this.rl.question('> ', command => {
            if (command.toLowerCase() === 'exit') {
                this.rl.close();
                console.log('Exiting...');
            } else {
                this.executeCommand(command);
                this.run();
            }
        });
    }

    executeCommand(command) {
        const cmd = command.split(' ');
        const args = cmd.slice(1,)
        const firstArg = args[0]

        switch (cmd[0]) {
            case 'ls':
                this.currentDirectory.listContents();
                break;
            case 'cd':
                this.changeDirectory(firstArg);
                break;
            case 'mkdir':
                this.createDirectory(args);
                break;
            case 'cat':
                this.displayFileContents(firstArg);
                break;
            case 'touch':
                this.createFile(firstArg);
                break;
            case 'echo':
                this.echo(args);
                break;
            case 'grep':
                this.grep(args.join(' '));
                break;
            case 'mv':
                this.move(args);
                break;
            case 'cp':
                this.copy(args);
                break;
            case 'rm':
                this.remove(firstArg);
                break;
            default:
                console.log("Unknown command:");
        }
    }

    changeDirectory(dirPath) {
        const targetDirectory = this.resolvePath(dirPath);
        if (targetDirectory) {
            this.currentDirectory = targetDirectory;
        } else {
            console.log(`Directory not found: ${dirPath}`);
        }
    }

    getRootDirectory() {
        let currentDir = this.currentDirectory;
        while (currentDir.parentDirectory) {
            currentDir = currentDir.parentDirectory;
        }
        return currentDir;
    }

    resolvePath(dirPath) {
        if (dirPath === '/') {
            return this.getRootDirectory();
        } else if (dirPath.startsWith('/')) {
            return this.findDirectoryByAbsolutePath(dirPath);
        } else {
            return this.findObjectByRelativePath(dirPath);
        }
    }

    findDirectoryByAbsolutePath(absPath) {
        const pathComponents = absPath.split('/').filter(component => component !== '');
        let currentDir = this.currentDirectory;

        for (const component of pathComponents) {
            const nextDir = currentDir.findObject(component);

            if (nextDir instanceof Directory) {
                currentDir = nextDir;
            } else {
                return null; 
            }
        }

        return currentDir;
    }


    findObjectByRelativePath(relPath) {
        const pathComponents = relPath.split('/').filter(component => component !== '');
    
        let currentDir = this.currentDirectory;
    
        for (const component of pathComponents) {
            if (component === '..') {
                currentDir = currentDir.parentDirectory || currentDir;
            } else {
                const nextObject = currentDir.findObject(component);
    
                if (nextObject) {
                    currentDir = nextObject;
                } else {
                    return null;
                }
            }
        }
    
        return currentDir;
    }

    
    createDirectory(dirName) {
        dirName.forEach( dirName => {
            this.currentDirectory.addDirectory(dirName);
        })
        
    }

    displayFileContents(fileName) {
        const file = this.currentDirectory.findObject(fileName);

        if (file instanceof File) {
            console.log(file.getContent());
        } else {
            console.log(`File not found: ${fileName}`);
        }
    }

    createFile(fileName) {
        const newFile = new File(fileName);
        newFile.setParentDirectory(this.currentDirectory);
        this.currentDirectory.contents.push(newFile);
    }

    echo(args) {
        const text = args.join(' ');
        const [content, fileName] = text.split('>');
        const trimmedContent = content.trim();
        const trimmedFileName = fileName.trim();
    
        if (trimmedContent && trimmedFileName) {
            const file = this.currentDirectory.findObject(trimmedFileName);
    
            if (file instanceof File) {
                file.setContent(trimmedContent);
                console.log(`Text written to ${trimmedFileName}`);
            } else {
                console.log(`File not found: ${trimmedFileName}`);
            }
        } else {
            console.log('Invalid echo command format. Use: echo \'text\' > file.txt');
        }
    }

    grep(pattern) {
        const files = this.currentDirectory.contents.filter(item => item instanceof File);
        files.forEach(file => {
            const content = file.getContent();
            if (content.includes(pattern)) {
                console.log(`Pattern found in ${file.name}: ${content}`);
            }
        });
    }

    move(args) {
        const [sourcePath, destinationPath] = args.join(' ').split(' ');

        const sourceFileOrFolder = this.resolvePath(sourcePath);
        const destinationDir = this.resolvePath(destinationPath);
        
        if (sourceFileOrFolder instanceof File && destinationDir instanceof Directory) {
            destinationDir.addFile(sourceFileOrFolder.name, sourceFileOrFolder.getContent());
            this.remove(sourcePath);
            console.log(`File moved from ${sourcePath} to ${destinationPath}`);
        } else if (sourceFileOrFolder instanceof Directory && destinationDir instanceof Directory) {
            destinationDir.addDirectory(sourceFileOrFolder.name);
            destinationDir.contents[destinationDir.contents.length - 1].contents = [...sourceFileOrFolder.contents];
            this.remove(sourcePath);
            console.log(`Directory moved from ${sourcePath} to ${destinationPath}`);
        } else {
            console.log(`Invalid move operation: ${sourcePath} or ${destinationPath} not found`);
        }
    }

    copy(args) {
        const [sourcePath, destinationPath] = args.join(' ').split( ' ');

        const sourceFile = this.resolvePath(sourcePath);
        const destinationDir = this.resolvePath(destinationPath);

        if (sourceFile instanceof File && destinationDir instanceof Directory) {
            destinationDir.addFile(sourceFile.name, sourceFile.getContent());
            console.log(`File copied from ${sourcePath} to ${destinationPath}`);
        } else {
            console.log(`Invalid copy operation: ${sourcePath} or ${destinationPath} not found`);
        }
    }

    remove(args) {
        const targetPath = this.resolvePath(args);
        if (targetPath instanceof File) {
            const parentDir = targetPath.parentDirectory;
            parentDir.contents = parentDir.contents.filter(item => item !== targetPath);
            console.log(`File removed: ${args}`);
        } else if (targetPath instanceof Directory) {
            const parentDir = targetPath.parentDirectory;
            parentDir.contents = parentDir.contents.filter(item => item !== targetPath);
            console.log(`Directory removed: ${args}`);
        } else {
            console.log(`Invalid remove operation: ${args} not found`);
        }
    }
}

// Example usage
const terminal = new Terminal();
terminal.start();