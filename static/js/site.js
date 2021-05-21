function toggleTheme() {

        var prettifyDark = document.getElementById('prettify-dark')
        var sheets = document.styleSheets
        
        // temporariily set transition class on html element
        //document.documentElement.classList.add('transition-theme')
        
        // change data-theme
        //if (target.classList.contains('darkTheme')) {
            document.documentElement.setAttribute("data-theme", "dark")
            //prettifyDark.removeAttribute('disabled')
            //prettifyDark.disabled = false
        /*} else {
            document.documentElement.removeAttribute("data-theme", "dark")
            prettifyDark.disabled = true
        }*/
        
        // remove transition class
        window.setTimeout(function() {
            document.documentElement.classList.remove('transition-theme')
        }, 1000)
    
}
