React.initializeTouchEvents(true);

$(function() {
  var mountNode = document.getElementById('app');

  var blankBoard = [];
  
  var i = 16;
  while (i--) {
    blankBoard.push(1);
  }

  var Bin = {
    'change_directory': {
      name: 'change_directory',
      arguments: [
        ['directory', 'linked_directory']
      ],
      source: function(target) {
        if (target.type === 'linked_directory') {
          target = target.link;
        }

        this.changeDirectory(target);
      }
    },

    'move': {
      name: 'move',
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
      }
    },

    'decrypt': {
      name: 'decrypt',
      arguments: [
        ['key_file'],
        ['encrypted_file']
      ],
      source: function(key, file) {
        var i = file.parent.listing.indexOf(file.name);
        file.parent.data[i].type = 'file';
        this.refresh();
      }
    }
  };

  var Shell = {
    directory: null,

    listing: blankBoard.slice(),

    script: null,

    scriptParams: [],

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
      console.log('interacting with ' + obj.type);
      
      if (!Shell.script) {
        if (obj.type === 'script' && Bin[obj.name]) {
          console.log('setting script to ' + obj.name);
          Shell.script = Bin[obj.name];
          Shell.scriptParams.length = 0;
          console.log('');
          return;
        } else {
          console.log('setting default script to change_directory');
          Shell.script = Bin.change_directory;
          Shell.scriptParams.length = 0;
        }
      }

      var argNum = Shell.scriptParams.length;
      console.log('checking argument number ' + argNum)

      if (Shell.script.arguments[argNum] && Shell.script.arguments[argNum].indexOf(obj.type) >= 0) {
        Shell.scriptParams.push(obj);
        console.log('argument valid, adding to param list');

        if (Shell.scriptParams.length === Shell.script.arguments.length) {
          console.log('param list complete, calling method ' + Shell.script.name);
          Shell.script.source.apply(Shell, Shell.scriptParams);
          Shell.script = null;
          Shell.scriptParams.length = 0;
        }
      } else {
        console.log('argument not valid, aborting');
        Shell.script = null;
        Shell.scriptParams.length = 0;
      }

      console.log('');
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