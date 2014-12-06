React.initializeTouchEvents(true);

$(function() {
  var mountNode = document.getElementById('app');

  var App = React.createClass({
    render: function() {
      return null;
    },
  });
  
  React.render(
    <App query={query} />,
    mountNode
  );
});