React.initializeTouchEvents(true);

$(function() {
  var mountNode = document.getElementById('app');

  var blankBoard = [];
  
  var i = 16;
  while (i--) {
    blankBoard.push(1);
  }

  var Bin = {
    'inspect': {
      name: 'inspect',
      arguments: [
        ['file', 'encrypted_file', 'key_file']
      ],
      source: function(file) {
        this.log('name:', file.name);
        this.log('type:', file.type);
      },
      help: 'usage: inspect <file>',
    },

    'cd': {
      name: 'cd',
      arguments: [
        ['directory', 'linked_directory']
      ],
      source: function(target) {
        if (target.type === 'linked_directory') {
          target = target.link;
        }

        this.changeDirectory(target);
      },
      help: 'usage: cd <directory>',
    },

    'mv': {
      name: 'mv',
      arguments: [
        ['file', 'key_file'],
        ['directory', 'linked_directory']
      ],
      source: function(file, target) {
        if (target.type === 'linked_directory') {
          target = target.link;
        }
        
        var i = file.parent.listing.indexOf(file.name);
        file.parent.data.splice(i, 1);
        file.parent.listing.splice(i, 1);
        file.parent = target;
        target.data.push(file);
        target.listing.push(file.name);
        this.refresh();
      },
      help: 'usage: mv <file> <directory>',
    },

    'decrypt': {
      name: 'decrypt',
      arguments: [
        ['key_file'],
        ['encrypted_file']
      ],
      source: function(key, file) {
        this.log('decrypting', file.name);
        this.log('...');
        this.log('...');
        this.log(file.name, 'decrypted.');
        var i = file.parent.listing.indexOf(file.name);
        file.parent.data[i].type = 'file';
        this.refresh();
      },
      help: 'usage: decrypt <key_file> <encrypted_file>',
    },
  };


  var Shell = {
    directory: null,
    
    console: document.getElementById('console'),

    listing: blankBoard.slice(),

    script: null,

    scriptParams: [],

    log: function() {
      var preText = Shell.console.innerText;
      preText += Array.prototype.join.call(arguments, ' ') + '\n';
      Shell.console.innerText = preText;
    },

    clearDirectory: function() {
      var i = 16;
      while (i--) {
        Shell.listing[i] = 1;
      }
    },

    changeDirectory: function(directory) {
      var l = directory.data.length;
      var offset = directory.offset;
      var i;
      
      Shell.clearDirectory();

      while (l--) {
        i = (l + offset) % 16;
        Shell.listing[i] = directory.data[l];
      }

      Shell.directory = directory;
      Shell.fireCallbacks(Shell.onChangeDirectoryCallbacks);
    },

    onChangeDirectoryCallbacks: [],

    refresh: function() {
      Shell.changeDirectory(Shell.directory);
    },

    fireCallbacks: function(arr) {
      arr.forEach(function(cb) { cb(); });
    },

    interact: function(obj) {
      if (!Shell.script) {
        if (obj.type === 'script' && Bin[obj.name]) {
          Shell.log('$', obj.name);
          if (Bin[obj.name].help) {
            Shell.log(Bin[obj.name].help);
          }
          Shell.script = Bin[obj.name];
          return;
        } else if (obj.type === 'directory' || obj.type === 'linked_directory') {
          Shell.script = Bin.cd;
        } else {
          Shell.script = Bin.inspect;
        }
        
        Shell.scriptParams.length = 0;
      }

      var argNum = Shell.scriptParams.length;

      if (Shell.script.arguments[argNum] && Shell.script.arguments[argNum].indexOf(obj.type) >= 0) {
        Shell.scriptParams.push(obj);

        if (Shell.scriptParams.length === Shell.script.arguments.length) {
          Shell.log.apply(Shell, ['$', Shell.script.name].concat(Shell.scriptParams.map(function(obj) {
            return obj.name;
          })));
          Shell.script.source.apply(Shell, Shell.scriptParams);
          Shell.script = null;
          Shell.scriptParams.length = 0;
        }
      } else {
        Shell.script = null;
        Shell.scriptParams.length = 0;
      }
    }
  }

  var App = React.createClass({
    getInitialState: function() {
      return {
        activeBoard: blankBoard.slice(),
        activeDirectory: this.props.levelData,
      };
    },
    
    componentWillMount: function() {
      Shell.onChangeDirectoryCallbacks.push(this.onShellDirectoryChange);
      Shell.changeDirectory(this.state.activeDirectory);
    },

    render: function() {
      return <Board cells={this.state.activeBoard} />;
    },

    onShellDirectoryChange: function() {
      this.setState({
        activeBoard: Shell.listing,
      });
    },
  });

  var Cell = React.createClass({
    render: function() {
      return <a className={'cell ' + this.props.type}
                onClick={this.handleClick}>
        <canvas className="cell-contents" width="100" height="100" />
        <div className="cell-name">{this.props.name}</div>
      </a>;
    },

    handleClick: function() {
      Shell.interact(this.props);
    },
  });
  
  var Board = React.createClass({
    render: function() {
      return <div className="board">
        {this.props.cells.map(this.renderCell)}
      </div>;
    },

    renderCell: function(cell) {
      return <Cell {...cell} />;
    },
  });

  function decorateLevelData(data, parent) {
    if (parent && !data.parent) {
      data.parent = parent;
    }

    if (data.type === 'directory' && parent) {
      // set offset for child directories
      data.offset = parent.offset + parent.data.indexOf(data);
      
      // add ../ directory
      data.data.unshift({
        name: '../',
        type: 'linked_directory',
        link: parent,
      });
    }

    if (data.type === 'directory' || data.type === 'root_directory') {
      data.listing = data.data.map(function(child) {
        return child.name;
      });

      // call recursively
      data.data.forEach(function(child) {
        decorateLevelData(child, data);
      });
    }
  }

  $.getJSON('level1.json').then(function(data) {
    decorateLevelData(data, null);
    React.render(
      <App levelData={data} />,
      mountNode
    );
  }).fail(function(err) {
    debugger;
  });

});