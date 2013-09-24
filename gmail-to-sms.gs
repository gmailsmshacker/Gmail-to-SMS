// Gmail to SMS
//
// This Google Apps Script will check for new emails in your Gmail account
// and send you an SMS every time a new email comes in. It is recommended
// to set it up to run every 5 minutes for proper operation. To send
// you an SMS the script will insert temporarily an event into
// your Google Calendar with an SMS notification (be sure to setup
// SMS notifications in Google Calendar). The SMS will contain an abbreviated
// portion of the subject and message. Enjoy!
//
// This code is free software: you can redistribute it and/or modify it under
// the terms of the GNU Lesser General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// This code is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for
// more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with code. If not, see <http://www.gnu.org/licenses/>.

////
// Persistent, user-specific marker for the most recent time the emails were checked.
////

var STAMP = "Stamp";

function restamp(){
  var stamp = UserProperties.getProperty(STAMP);
  if(null == stamp){
    stamp = new Date().getTime();
  }
  UserProperties.setProperty(STAMP, new Date().getTime());
  return(stamp);
}

////
// Used for debugging only
////

function reset(){
  UserProperties.setProperty(STAMP, 0);
}

////
// Text only, no HTML body in email messages.
////

function plain(body){
  try{
    // Check if it is XML/HTML
    Xml.parse(body, true);
    // Get rid of the tags and preserve the order of the actual text
    return(body.replace(/<[\s\S]*?>/g, " "));
  }catch(exception){
    // It is plain text already
    return(body);
  }
}

////
// Extract first part of the email address.
////

function who(from){
  var marker = from.indexOf("<");
  if(marker != -1){
    from = from.substring(marker + 1);
  }
  marker = from.indexOf("@");
  from = from.substring(0, marker);
  return(from);
}

////
// Get rid of "Re:", "Fw:", etc.
////

function what(subject){
  subject = subject.replace("re:", "");
  subject = subject.replace("fw:", "");
  return(subject);
}

////
// We need only alphanumeric characters
////

function alphanumeric(text){
  return(text.replace(/[\W_]+/g, " "));
}

////
// Get rid of the white spaces.
////

function dark(text){
  // First, not multiple spaces
  while(text.indexOf("  ") != -1){
    text = text.replace("  ", " ");
  }
  // Second, turn first word letters to capitals
  var alphabet = "abcdefghijklmnopqrstuvwxyz";
  for(var i = 0; i < alphabet.length; i++){
    var match = " " + alphabet[i];
    var replacement = alphabet[i].toUpperCase();
    while(text.indexOf(match) != -1){
      text = text.replace(match, replacement);
    }
  }
  // Done
  return(text);
}

////
// Obtain recent emails
////

function fresh(){
  var recent = [];
  var stamp = restamp();
  var threads = GmailApp.getInboxThreads();
  for(var i = 0; i < threads.length; i++){
    var thread = threads[i];
    if(thread.getLastMessageDate().getTime() < stamp){
      continue;
    }
    var messages = thread.getMessages();
    var subject = what(thread.getFirstMessageSubject().toLowerCase());
    for(var j = 0; j < messages.length; j++){
      var message = messages[j];
      if(message.getDate().getTime() >= stamp){
        email = who(message.getFrom().toLowerCase());
        email += " " + subject;
        email += " " + plain(message.getBody().toLowerCase());
        email = dark(alphanumeric(email));
        recent.push(email);
      }
    }
  }
  return(recent);
}

////
// Find or create calendar for this script
////

var CALENDAR = ".";

function find(){
  var calendars = CalendarApp.getCalendarsByName(CALENDAR);
  if(null == calendars || 0 == calendars.length){
    return(CalendarApp.createCalendar(CALENDAR));
  }else{
    return(calendars[0]);
  }
}

////
// Add calendar-based notification
////

function notify(text){
  var now = new Date().getTime();
  find().createEvent(text, new Date(now + 2 * 60000), new Date(now + 3 * 60000)).addSmsReminder(1);
}

////
// Clear old notifications
////

function purge(){
  var now = new Date().getTime();
  var notifications = find().getEvents(new Date(0), new Date(now - 5 * 60000));
  for(var i = 0; i < notifications.length; i++){
    notifications[i].deleteEvent();
  }
}

////
// Main loop
////

function run(){
  Logger.log(new Date());
  var emails = fresh();
  for(var i = 0; i < emails.length; i++){
    notify(emails[i]);
  }
  purge();
}

var STATUS = "Status";

function trigger(app){
  app.addTimer(app.createServerHandler("update"), 5 * 60 * 1000);
}

function update(event){
  var app = UiApp.getActiveApplication();
  try{
    run();
  
    var now = new Date();
    app.getElementById(STATUS).setText("Last checked for new emails at " + Utilities.formatDate(now, "UTC", "HH:mm") + " UTC.");
  }catch(exception){
    // Ignore the error
  }
  trigger(app);
  return(app);
}

function doGet(){
  var app = UiApp.createApplication().setTitle("Gmail to SMS");
  var all = app.createVerticalPanel().setWidth("100%");
  all.setHorizontalAlignment(UiApp.HorizontalAlignment.CENTER);
  app.add(all);

  var who = app.createLabel("Gmail to SMS", false).setStyleAttributes({"font-weight":"bold", "font-size":"18pt", "padding-bottom":"5pt"});
  all.add(who);
  var container = app.createVerticalPanel();
  container.setStyleAttributes({"background-color":"#F5F5F5", "border":"1px solid #D9D9D9", "padding":"10px", "border-radius":"2px"});
  container.setHorizontalAlignment(UiApp.HorizontalAlignment.CENTER);
  all.add(container);

  var what = app.createLabel("This website enables you to get SMS notifications whenever you receive a new email on your Gmail account.", true);
  what.setStyleAttribute("padding-bottom", "5pt");
  container.add(what);
  var how = app.createLabel("To accomplish that this website uses SMS notifications of Google Calendar.", true);
  container.add(how);
  var where = app.createAnchor("To learn how to enable them follow this link.", "http://support.google.com/calendar/bin/answer.py?hl=en&answer=45351");
  container.add(where);
  var keep = app.createLabel("Please keep this page open for as long as you want the notifications to remain active (make sure to bookmark it for later).", true);
  container.add(keep);
  var when = app.createLabel("", true).setId(STATUS);
  when.setStyleAttribute("padding-top", "5pt");
  container.add(when);
  
  trigger(app);
  return(app);
}

////
// Script activation/deactivation.
////

function disable(){
  var triggers = ScriptApp.getScriptTriggers();
  for(var i = 0; i < triggers.length; i++){
    ScriptApp.deleteTrigger(triggers[i]);
  }
}

function enable(){
  disable();
  ScriptApp.newTrigger('sendText').timeBased().everyMinutes(5).create();
}
