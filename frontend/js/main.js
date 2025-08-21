(function ($) {
  "use strict";

  // Hide the loading spinner once page is ready
  var spinner = function () {
    setTimeout(function () {
      if ($('#spinner').length > 0) {
        $('#spinner').removeClass('show');
      }
    }, 1);
  };
  spinner();

  // Toggle sidebar
  $('.sidebar-toggler').click(function () {
    $('.sidebar, .content').toggleClass('open');
    return false;
  });
})(jQuery);
