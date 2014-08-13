function ItemSection(name, value, item_view){
	var section = this

	section.name = name;
	section.item_view = item_view;

	item_view.browser.type_cache.load(name, function(err, data){
        // console.log("ITEM SECTION");
		// console.log(err);
		// console.log(data);
        section.populate_type(data);
        section.populate(value);
	})

    section.init_called = false;
}

ItemSection.prototype.init = function(){
    var section = this;

    if(section.field){
        section.field.init();
    }

    section.init_called = true;
}

ItemSection.prototype.remove = function(){
    var section = this;

    if(section.field){
        section.field.remove();
    }
}

ItemSection.prototype.val = function(argument){
    var section = this;

    return section.vr.field.val(argument);
}

ItemSection.prototype.error = function(argument){
    var section = this;

    if(section.field){
        return section.field.error(argument);
    }
}

ItemSection.prototype.edit_mode = function(){
    var section = this;
    
    section.is_edit_mode = true;

    if(section.field){
        section.field.edit_mode();
        section.remove_button.show();
    }
}

ItemSection.prototype.view_mode = function(){
    var section = this;
 
    section.is_edit_mode = false;

    if(section.field){
        section.field.view_mode();
        section.remove_button.hide();
    }
}

ItemSection.prototype.populate = function(data){
    var section = this;

    section.val(data);
}

ItemSection.prototype.remove_press = function(){
    var section = this;

    section.item_view.remove_section(section.name);
    section.item_view.form.remove_field(name);
}

ItemSection.prototype.populate_type = function(type){
	var section = this;

	section.type = type;

    section.vr = new ValidationRule();
	console.log(section.vr.init(type));

	section.field = section.vr.field.create_ui(section.item_view.form);

    section.field.container.addClass("item_section");

    section.field.title.append(
        section.remove_button = $("<button />").addClass("mino_button").text("Remove").on('tap',function(event){
            event.preventDefault();
            section.remove_press();
        }).hide()
    )

    if(section.init_called){
        section.field.init();
    }

    if(section.is_edit_mode){
        section.edit_mode();
    } else {
        section.view_mode();
    }

}